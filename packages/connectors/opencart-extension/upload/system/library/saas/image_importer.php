<?php
/**
 * SaaS Connector Image Importer & Binary Validator
 * Enforces strict magic byte verification, SSRF protection, size & timeout limits
 */
class SaasImageImporter {
    private $db;
    private $prefix;

    public function __construct($registry) {
        $this->db = $registry->get('db');
        $this->prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
    }

    /**
     * Download and validate remote image, ensuring SHA-256 deduplication
     */
    public function importImage($remoteUrl, $sku, $isPrimary = false) {
        if (empty($remoteUrl) || !filter_var($remoteUrl, FILTER_VALIDATE_URL)) {
            return null;
        }

        // SSRF Protection: Reject private/local IPs
        $host = parse_url($remoteUrl, PHP_URL_HOST);
        $ip = gethostbyname($host);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return null;
        }

        // Download image binary (Max 15MB, 15s timeout)
        $ch = curl_init($remoteUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; SaasProductImporter/2.0)');
        $imageData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentLength = curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD);
        curl_close($ch);

        if ($httpCode !== 200 || empty($imageData)) {
            return null;
        }

        if ($contentLength > (15 * 1024 * 1024)) {
            return null; // Exceeds 15MB
        }

        // SHA-256 Content Hash
        $sha256 = hash('sha256', $imageData);

        // Check deduplication registry
        $regQuery = $this->db->query("SELECT store_relative_path FROM `" . $this->prefix . "saas_image_registry` WHERE `sha256` = '{$sha256}' LIMIT 1");
        if ($regQuery && $regQuery->num_rows > 0) {
            $existingRelative = $regQuery->row['store_relative_path'];
            $fullPath = (defined('DIR_IMAGE') ? DIR_IMAGE : 'image/') . $existingRelative;
            if (file_exists($fullPath)) {
                return $existingRelative;
            }
        }

        // Binary Magic Byte Inspection
        $magicBytes = substr($imageData, 0, 8);
        $ext = '';
        if (substr($magicBytes, 0, 3) === "\xFF\xD8\xFF") {
            $ext = 'jpg';
        } elseif (substr($magicBytes, 0, 8) === "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A") {
            $ext = 'png';
        } elseif (substr($magicBytes, 0, 4) === "RIFF" && substr($imageData, 8, 4) === "WEBP") {
            $ext = 'webp';
        } elseif (substr($magicBytes, 0, 6) === "GIF87a" || substr($magicBytes, 0, 6) === "GIF89a") {
            $ext = 'gif';
        } else {
            // Unsafe format or SVG/Script masquerading as image -> Reject!
            return null;
        }

        // Save into local OpenCart storage
        $imageDir = defined('DIR_IMAGE') ? DIR_IMAGE : 'image/';
        $targetRelDir = 'catalog/saas/';
        $targetFullDir = rtrim($imageDir, '/') . '/' . $targetRelDir;

        if (!is_dir($targetFullDir)) {
            @mkdir($targetFullDir, 0755, true);
        }

        $safeSku = preg_replace('/[^a-zA-Z0-9_-]/', '_', $sku);
        $fileName = $safeSku . '_' . substr($sha256, 0, 10) . '.' . $ext;
        $targetFile = $targetFullDir . $fileName;

        if (!file_exists($targetFile)) {
            file_put_contents($targetFile, $imageData);
        }

        $savedRelativePath = $targetRelDir . $fileName;

        // Register in Deduplication Index
        $safeUrl = $this->db->escape($remoteUrl);
        $safeRel = $this->db->escape($savedRelativePath);
        $this->db->query("INSERT IGNORE INTO `" . $this->prefix . "saas_image_registry` (`sha256`, `remote_url`, `store_relative_path`, `created_at`) VALUES ('{$sha256}', '{$safeUrl}', '{$safeRel}', NOW())");

        return $savedRelativePath;
    }
}


<?php
/**
 * SaaS Connector Security Library
 * Handles HMAC-SHA256 signature verification, Nonce replay prevention, and Token Lifecycle
 */
class SaasSecurity {
    private $db;
    private $prefix;

    public function __construct($registry) {
        $this->db = $registry->get('db');
        $this->prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
    }

    /**
     * Verify HMAC-SHA256 signature with 300-second timestamp window and Nonce cache
     */
    public function verifyRequest($payloadRaw, $signature, $timestamp, $nonce, $secretKey) {
        if (empty($signature) || empty($timestamp) || empty($nonce) || empty($secretKey)) {
            return ['valid' => false, 'error' => 'Missing security headers (Signature, Timestamp, or Nonce)'];
        }

        // 1. Verify Timestamp Window (300 seconds drift allowed)
        $currentTime = time();
        if (abs($currentTime - (int)$timestamp) > 300) {
            return ['valid' => false, 'error' => 'Request expired: Timestamp drift exceeds 300 seconds'];
        }

        // 2. Nonce Replay Attack Prevention
        $safeNonce = $this->db->escape($nonce);
        $nonceChk = $this->db->query("SELECT id FROM `" . $this->prefix . "saas_nonce_cache` WHERE `nonce` = '{$safeNonce}' LIMIT 1");
        if ($nonceChk && $nonceChk->num_rows > 0) {
            return ['valid' => false, 'error' => 'Replay attack detected: Nonce has already been consumed'];
        }

        // Cache Nonce
        $this->db->query("INSERT INTO `" . $this->prefix . "saas_nonce_cache` (`nonce`, `created_at`) VALUES ('{$safeNonce}', NOW())");

        // Clean old nonces older than 15 minutes
        $this->db->query("DELETE FROM `" . $this->prefix . "saas_nonce_cache` WHERE `created_at` < DATE_SUB(NOW(), INTERVAL 15 MINUTE)");

        // 3. Verify HMAC-SHA256 Signature
        $expectedSignature = hash_hmac('sha256', $payloadRaw . $timestamp . $nonce, $secretKey);
        if (!hash_equals($expectedSignature, $signature)) {
            return ['valid' => false, 'error' => 'Invalid HMAC-SHA256 signature: Secret key mismatch'];
        }

        return ['valid' => true];
    }
}

<?php
class ModelExtensionModuleProductIntelligence extends Model {
    
    /**
     * Installs necessary table for integration logs
     */
    public function install() {
        $this->db->query("CREATE TABLE IF NOT EXISTS `" . DB_PREFIX . "product_intelligence_log` (
            `log_id` INT(11) NOT NULL AUTO_INCREMENT,
            `product_id` INT(11) DEFAULT NULL,
            `operation` VARCHAR(64) NOT NULL,
            `status` VARCHAR(32) NOT NULL,
            `details` TEXT DEFAULT NULL,
            `created_at` DATETIME NOT NULL,
            PRIMARY KEY (`log_id`),
            KEY `product_id` (`product_id`),
            KEY `created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    }

    /**
     * Uninstalls integration table
     */
    public function uninstall() {
        $this->db->query("DROP TABLE IF EXISTS `" . DB_PREFIX . "product_intelligence_log`;");
    }

    /**
     * Log an integration activity safely (never stores secrets or sensitive tokens)
     */
    public function logActivity($operation, $status, $details = [], $productId = null) {
        $sanitizedDetails = $details;
        if (is_array($sanitizedDetails)) {
            // Strip any sensitive keys if present
            unset($sanitizedDetails['apiKey'], $sanitizedDetails['X-API-Key'], $sanitizedDetails['token'], $sanitizedDetails['secret']);
            $detailsJson = json_encode($sanitizedDetails);
        } else {
            $detailsJson = (string)$sanitizedDetails;
        }

        $pId = $productId ? (int)$productId : "NULL";

        $this->db->query("INSERT INTO `" . DB_PREFIX . "product_intelligence_log` 
            (`product_id`, `operation`, `status`, `details`, `created_at`) 
            VALUES (" . $pId . ", '" . $this->db->escape($operation) . "', '" . $this->db->escape($status) . "', '" . $this->db->escape($detailsJson) . "', NOW())");
    }

    /**
     * Retrieve recent integration logs
     */
    public function getLogs($limit = 30) {
        $query = $this->db->query("SELECT l.*, pd.name as product_name 
            FROM `" . DB_PREFIX . "product_intelligence_log` l 
            LEFT JOIN `" . DB_PREFIX . "product_description` pd ON (l.product_id = pd.product_id AND pd.language_id = '" . (int)$this->config->get('config_language_id') . "') 
            ORDER BY l.log_id DESC LIMIT " . (int)$limit);
        return $query->rows;
    }

    /**
     * Get OpenCart product data for comparison
     */
    public function getProductData($productId) {
        $query = $this->db->query("SELECT p.*, pd.name, pd.description, pd.meta_title 
            FROM `" . DB_PREFIX . "product` p 
            LEFT JOIN `" . DB_PREFIX . "product_description` pd ON (p.product_id = pd.product_id AND pd.language_id = '" . (int)$this->config->get('config_language_id') . "') 
            WHERE p.product_id = '" . (int)$productId . "'");
        return $query->row;
    }

    /**
     * Applies selective synchronization to OpenCart product.
     * STRICT DATA OWNERSHIP: Never overwrites price, quantity, or category unless explicitly programmed and authorized.
     */
    public function syncSelectedFields($productId, $selectedFields, $intelligenceData) {
        $updatedFields = [];
        $pId = (int)$productId;
        $langId = (int)$this->config->get('config_language_id');

        // Check Product Table fields (model, ean, upc, mpn, etc.)
        $productUpdates = [];
        if (!empty($selectedFields['model']) && !empty($intelligenceData['model'])) {
            $productUpdates[] = "`model` = '" . $this->db->escape($intelligenceData['model']) . "'";
            $updatedFields['model'] = $intelligenceData['model'];
        }
        if (!empty($selectedFields['ean']) && !empty($intelligenceData['ean'])) {
            $productUpdates[] = "`ean` = '" . $this->db->escape($intelligenceData['ean']) . "'";
            $updatedFields['ean'] = $intelligenceData['ean'];
        }
        if (!empty($selectedFields['mpn']) && !empty($intelligenceData['mpn'])) {
            $productUpdates[] = "`mpn` = '" . $this->db->escape($intelligenceData['mpn']) . "'";
            $updatedFields['mpn'] = $intelligenceData['mpn'];
        }

        if (!empty($productUpdates)) {
            $this->db->query("UPDATE `" . DB_PREFIX . "product` SET " . implode(', ', $productUpdates) . ", `date_modified` = NOW() WHERE `product_id` = " . $pId);
        }

        // Check Product Description fields (name, description, meta_title)
        $descUpdates = [];
        if (!empty($selectedFields['name']) && !empty($intelligenceData['name'])) {
            $descUpdates[] = "`name` = '" . $this->db->escape($intelligenceData['name']) . "'";
            $updatedFields['name'] = $intelligenceData['name'];
        }
        if (!empty($selectedFields['description']) && !empty($intelligenceData['description'])) {
            $descUpdates[] = "`description` = '" . $this->db->escape($intelligenceData['description']) . "'";
            $updatedFields['description'] = substr($intelligenceData['description'], 0, 100) . '...';
        }
        if (!empty($selectedFields['meta_title']) && !empty($intelligenceData['meta_title'])) {
            $descUpdates[] = "`meta_title` = '" . $this->db->escape($intelligenceData['meta_title']) . "'";
            $updatedFields['meta_title'] = $intelligenceData['meta_title'];
        }

        if (!empty($descUpdates)) {
            $this->db->query("UPDATE `" . DB_PREFIX . "product_description` SET " . implode(', ', $descUpdates) . " WHERE `product_id` = " . $pId . " AND `language_id` = " . $langId);
        }

        $this->logActivity('sync_fields_applied', 'SUCCESS', [
            'updated_fields' => array_keys($updatedFields),
            'field_count' => count($updatedFields)
        ], $pId);

        return $updatedFields;
    }
}


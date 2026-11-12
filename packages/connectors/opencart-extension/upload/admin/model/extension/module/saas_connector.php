<?php
/**
 * SaaS Connector Admin Model
 * Handles table installation, uninstallation, schema migrations and telemetry reporting
 */
class ModelExtensionModuleSaasConnector extends Model {
    
    public function install() {
        $prefix = defined('DB_PREFIX') ? DB_PREFIX : '';

        // 1. Dedicated Custom Tabs Table
        $this->db->query("CREATE TABLE IF NOT EXISTS `{$prefix}saas_product_tabs` (
            `tab_id` INT AUTO_INCREMENT PRIMARY KEY,
            `product_id` INT NOT NULL,
            `language_id` INT NOT NULL DEFAULT 1,
            `tab_key` VARCHAR(64) NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `content` MEDIUMTEXT NOT NULL,
            `template_id` VARCHAR(64) NOT NULL DEFAULT '',
            `template_version` INT NOT NULL DEFAULT 1,
            `content_hash` VARCHAR(64) NOT NULL DEFAULT '',
            `raw_structured_json` MEDIUMTEXT,
            `sort_order` INT NOT NULL DEFAULT 0,
            `status` TINYINT(1) NOT NULL DEFAULT 1,
            INDEX(`product_id`),
            INDEX(`tab_key`),
            INDEX(`language_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // 2. Dedicated Option SKU Mapping Table (No core ALTER)
        $this->db->query("CREATE TABLE IF NOT EXISTS `{$prefix}saas_option_sku_map` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `product_id` INT NOT NULL,
            `product_option_value_id` INT NOT NULL,
            `sku` VARCHAR(64) NOT NULL,
            `barcode` VARCHAR(64) DEFAULT NULL,
            `created_at` DATETIME NOT NULL,
            `updated_at` DATETIME NOT NULL,
            UNIQUE KEY `uniq_pov` (`product_option_value_id`),
            INDEX `idx_product` (`product_id`),
            INDEX `idx_sku` (`sku`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // 3. Image Deduplication Registry
        $this->db->query("CREATE TABLE IF NOT EXISTS `{$prefix}saas_image_registry` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `sha256` CHAR(64) NOT NULL,
            `remote_url` TEXT NOT NULL,
            `store_relative_path` VARCHAR(255) NOT NULL,
            `created_at` DATETIME NOT NULL,
            UNIQUE KEY `idx_sha` (`sha256`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // 4. Nonce Replay Prevention Cache
        $this->db->query("CREATE TABLE IF NOT EXISTS `{$prefix}saas_nonce_cache` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `nonce` VARCHAR(128) NOT NULL,
            `created_at` DATETIME NOT NULL,
            UNIQUE KEY `idx_nonce` (`nonce`),
            INDEX `idx_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // 5. Export History & Rollback Table
        $this->db->query("CREATE TABLE IF NOT EXISTS `{$prefix}saas_export_history` (
            `export_id` VARCHAR(64) PRIMARY KEY,
            `product_id` INT NOT NULL,
            `idempotency_key` VARCHAR(128) NOT NULL,
            `snapshot_before` MEDIUMTEXT,
            `snapshot_after` MEDIUMTEXT,
            `created_at` DATETIME NOT NULL,
            INDEX(`product_id`),
            INDEX(`idempotency_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // 6. Diagnostic Log Table
        $this->db->query("CREATE TABLE IF NOT EXISTS `{$prefix}saas_log` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `level` VARCHAR(20) NOT NULL DEFAULT 'INFO',
            `message` TEXT NOT NULL,
            `context` MEDIUMTEXT,
            `created_at` DATETIME NOT NULL,
            INDEX(`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public function uninstall($purgeData = false) {
        if ($purgeData) {
            $prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
            $this->db->query("DROP TABLE IF EXISTS `{$prefix}saas_product_tabs`");
            $this->db->query("DROP TABLE IF EXISTS `{$prefix}saas_option_sku_map`");
            $this->db->query("DROP TABLE IF EXISTS `{$prefix}saas_image_registry`");
            $this->db->query("DROP TABLE IF EXISTS `{$prefix}saas_nonce_cache`");
            $this->db->query("DROP TABLE IF EXISTS `{$prefix}saas_export_history`");
            $this->db->query("DROP TABLE IF EXISTS `{$prefix}saas_log`");
        }
    }

    /**
     * Gather Sanitized Environment Audit Telemetry
     */
    public function getEnvironmentAudit() {
        $prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
        
        // Theme check
        $activeTheme = 'default';
        $themeQuery = $this->db->query("SELECT `value` FROM `{$prefix}setting` WHERE `key` = 'config_theme'");
        if ($themeQuery && $themeQuery->num_rows > 0) {
            $activeTheme = $themeQuery->row['value'];
        }

        $hasJournal = false;
        $jTable = $this->db->query("SHOW TABLES LIKE '{$prefix}journal3_product_data'");
        if ($jTable && $jTable->num_rows > 0) {
            $hasJournal = true;
        }

        // Active Languages
        $languages = [];
        $langQuery = $this->db->query("SELECT language_id, name, code, locale FROM `{$prefix}language` WHERE status = 1");
        if ($langQuery) {
            $languages = $langQuery->rows;
        }

        return [
            'opencart_version' => VERSION,
            'connector_version' => '2.0.0',
            'php_version' => PHP_VERSION,
            'mysql_version' => $this->db->query("SELECT VERSION() as v")->row['v'] ?? 'unknown',
            'active_theme' => [
                'name' => $activeTheme,
                'is_journal' => $hasJournal,
            ],
            'server_limits' => [
                'upload_max_filesize' => ini_get('upload_max_filesize'),
                'post_max_size' => ini_get('post_max_size'),
                'memory_limit' => ini_get('memory_limit'),
                'max_execution_time' => (int)ini_get('max_execution_time'),
            ],
            'directory_permissions' => [
                'image_catalog_writable' => is_writable(DIR_IMAGE),
            ],
            'store_languages' => $languages,
        ];
    }
}

<?php
/**
 * SaaS Connector Options & SKU Engine
 * Handles Option Resolution, Option Value linking, and Dedicated SKU Mapping (Tier 1)
 */
class SaasOptionsEngine {
    private $db;
    private $prefix;

    public function __construct($registry) {
        $this->db = $registry->get('db');
        $this->prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
    }

    /**
     * Synchronize structured options, price modifiers, and dedicated SKUs for a product
     */
    public function syncProductOptions($productId, $optionsPayload, $defaultLanguageId = 1) {
        if (!is_array($optionsPayload) || empty($optionsPayload)) {
            return;
        }

        foreach ($optionsPayload as $opt) {
            $optName = trim($opt['name'] ?? '');
            if (empty($optName)) continue;

            $safeOptName = $this->db->escape($optName);

            // 1. Resolve or Create Global Option (oc_option)
            $optQuery = $this->db->query("SELECT o.option_id FROM `" . $this->prefix . "option` o LEFT JOIN `" . $this->prefix . "option_description` od ON (o.option_id = od.option_id) WHERE LOWER(od.name) = LOWER('{$safeOptName}') AND od.language_id = " . (int)$defaultLanguageId . " LIMIT 1");

            if ($optQuery && $optQuery->num_rows > 0) {
                $optionId = (int)$optQuery->row['option_id'];
            } else {
                // Create New Global Option (select type)
                $this->db->query("INSERT INTO `" . $this->prefix . "option` SET `type` = 'select', `sort_order` = 0");
                $optionId = (int)$this->db->getLastId();

                $langs = $this->db->query("SELECT language_id FROM `" . $this->prefix . "language`");
                if ($langs) {
                    foreach ($langs->rows as $l) {
                        $this->db->query("INSERT INTO `" . $this->prefix . "option_description` SET `option_id` = {$optionId}, `language_id` = " . (int)$l['language_id'] . ", `name` = '{$safeOptName}'");
                    }
                }
            }

            // 2. Link Option to Product (oc_product_option)
            $prodOptQuery = $this->db->query("SELECT product_option_id FROM `" . $this->prefix . "product_option` WHERE `product_id` = " . (int)$productId . " AND `option_id` = {$optionId} LIMIT 1");
            if ($prodOptQuery && $prodOptQuery->num_rows > 0) {
                $productOptionId = (int)$prodOptQuery->row['product_option_id'];
            } else {
                $this->db->query("INSERT INTO `" . $this->prefix . "product_option` SET `product_id` = " . (int)$productId . ", `option_id` = {$optionId}, `required` = 0");
                $productOptionId = (int)$this->db->getLastId();
            }

            // 3. Resolve Option Values & Dedicated SKUs
            $values = $opt['values'] ?? [];
            if (is_array($values)) {
                foreach ($values as $val) {
                    $choiceName = trim($val['name'] ?? '');
                    if (empty($choiceName)) continue;

                    $safeChoiceName = $this->db->escape($choiceName);
                    $priceMod = isset($val['priceModifier']) ? (float)$val['priceModifier'] : 0.0;
                    $pricePfx = ($val['pricePrefix'] ?? '+') === '-' ? '-' : '+';
                    $optSku = trim($val['sku'] ?? '');

                    // Check if option value exists in oc_option_value
                    $valQuery = $this->db->query("SELECT ov.option_value_id FROM `" . $this->prefix . "option_value` ov LEFT JOIN `" . $this->prefix . "option_value_description` ovd ON (ov.option_value_id = ovd.option_value_id) WHERE ov.option_id = {$optionId} AND LOWER(ovd.name) = LOWER('{$safeChoiceName}') AND ovd.language_id = " . (int)$defaultLanguageId . " LIMIT 1");

                    if ($valQuery && $valQuery->num_rows > 0) {
                        $optionValueId = (int)$valQuery->row['option_value_id'];
                    } else {
                        // Create Option Value
                        $this->db->query("INSERT INTO `" . $this->prefix . "option_value` SET `option_id` = {$optionId}, `image` = '', `sort_order` = 0");
                        $optionValueId = (int)$this->db->getLastId();

                        $langs = $this->db->query("SELECT language_id FROM `" . $this->prefix . "language`");
                        if ($langs) {
                            foreach ($langs->rows as $l) {
                                $this->db->query("INSERT INTO `" . $this->prefix . "option_value_description` SET `option_value_id` = {$optionValueId}, `language_id` = " . (int)$l['language_id'] . ", `option_id` = {$optionId}, `name` = '{$safeChoiceName}'");
                            }
                        }
                    }

                    // Link to oc_product_option_value
                    $povCheck = $this->db->query("SELECT product_option_value_id FROM `" . $this->prefix . "product_option_value` WHERE `product_option_id` = {$productOptionId} AND `option_value_id` = {$optionValueId} LIMIT 1");
                    
                    if ($povCheck && $povCheck->num_rows > 0) {
                        $productOptionValueId = (int)$povCheck->row['product_option_value_id'];
                        $this->db->query("UPDATE `" . $this->prefix . "product_option_value` SET `price` = {$priceMod}, `price_prefix` = '{$pricePfx}', `subtract` = 0 WHERE `product_option_value_id` = {$productOptionValueId}");
                    } else {
                        $this->db->query("INSERT INTO `" . $this->prefix . "product_option_value` SET `product_option_id` = {$productOptionId}, `product_id` = " . (int)$productId . ", `option_id` = {$optionId}, `option_value_id` = {$optionValueId}, `quantity` = 0, `subtract` = 0, `price` = {$priceMod}, `price_prefix` = '{$pricePfx}', `points` = 0, `points_prefix` = '+', `weight` = 0, `weight_prefix` = '+'");
                        $productOptionValueId = (int)$this->db->getLastId();
                    }

                    // 4. Save Dedicated Option SKU (Tier 1 Safe Table)
                    if (!empty($optSku)) {
                        $safeSku = $this->db->escape($optSku);
                        $this->db->query("INSERT INTO `" . $this->prefix . "saas_option_sku_map` (`product_id`, `product_option_value_id`, `sku`, `created_at`, `updated_at`) VALUES (" . (int)$productId . ", {$productOptionValueId}, '{$safeSku}', NOW(), NOW()) ON DUPLICATE KEY UPDATE `sku` = '{$safeSku}', `updated_at` = NOW()");
                    }
                }
            }
        }
    }
}


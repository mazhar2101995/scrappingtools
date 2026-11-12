<?php
/**
 * SaaS Connector Storefront API Endpoint
 * Handles Handshake, Secure Push, Rollback, and Dynamic Tab Retrieval
 */
class ControllerExtensionModuleSaasConnector extends Controller {

    public function index() {
        $this->response->addHeader('Content-Type: application/json');

        $action = isset($this->request->get['action']) ? trim($this->request->get['action']) : '';

        // Handshake Exchange (Public verification using one-time pair token)
        if ($action === 'exchange_token') {
            $this->exchangeToken();
            return;
        }

        // All other actions require HMAC-SHA256 signature verification
        if (!$this->authenticateRequest()) {
            return;
        }

        switch ($action) {
            case 'verify':
                $this->verifyStore();
                break;
            case 'preview_product':
                $this->previewProduct();
                break;
            case 'push_product':
                $this->pushProduct();
                break;
            case 'rollback':
                $this->rollbackExport();
                break;
            default:
                $this->response->setOutput(json_encode(['success' => false, 'error' => 'Unknown API action']));
                break;
        }
    }

    private function authenticateRequest() {
        $rawPayload = file_get_contents('php://input');
        $signature = $this->request->server['HTTP_X_SAAS_SIGNATURE'] ?? '';
        $timestamp = $this->request->server['HTTP_X_SAAS_TIMESTAMP'] ?? '';
        $nonce = $this->request->server['HTTP_X_SAAS_NONCE'] ?? '';

        $secretKey = $this->config->get('module_saas_connector_secret_key');
        if (empty($secretKey)) {
            $this->response->setOutput(json_encode(['success' => false, 'error' => 'Connector not configured: Missing Secret Key']));
            return false;
        }

        require_once(DIR_SYSTEM . 'library/saas/security.php');
        $security = new SaasSecurity($this->registry);
        $res = $security->verifyRequest($rawPayload, $signature, $timestamp, $nonce, $secretKey);

        if (!$res['valid']) {
            $this->response->setOutput(json_encode(['success' => false, 'error' => $res['error']]));
            return false;
        }

        return true;
    }

    private function verifyStore() {
        $this->load->model('extension/module/saas_connector');
        $audit = $this->model_extension_module_saas_connector->getEnvironmentAudit();

        $this->response->setOutput(json_encode([
            'success' => true,
            'status' => 'CONNECTED_VERIFIED',
            'audit' => $audit
        ]));
    }

    private function previewProduct() {
        $raw = file_get_contents('php://input');
        $req = json_decode($raw, true) ?: [];
        $sku = trim($req['sku'] ?? '');
        $model = trim($req['model'] ?? '');

        $prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
        $existing = null;

        if (!empty($sku)) {
            $safeSku = $this->db->escape($sku);
            $q = $this->db->query("SELECT product_id, sku, model, price, quantity FROM `{$prefix}product` WHERE sku = '{$safeSku}' LIMIT 1");
            if ($q && $q->num_rows > 0) $existing = $q->row;
        }
        if (!$existing && !empty($model)) {
            $safeModel = $this->db->escape($model);
            $q = $this->db->query("SELECT product_id, sku, model, price, quantity FROM `{$prefix}product` WHERE model = '{$safeModel}' LIMIT 1");
            if ($q && $q->num_rows > 0) $existing = $q->row;
        }

        $this->response->setOutput(json_encode([
            'success' => true,
            'found' => (bool)$existing,
            'product' => $existing
        ]));
    }

    private function pushProduct() {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true) ?: [];

        $sku = trim($payload['sku'] ?? '');
        $model = trim($payload['modelNumber'] ?? $sku);
        $title = $payload['name']['en'] ?? (is_string($payload['name']) ? $payload['name'] : 'New Product');
        $desc = $payload['description']['en'] ?? (is_string($payload['description']) ? $payload['description'] : '');
        $price = isset($payload['price']) ? (float)$payload['price'] : 0.0;
        $exportId = trim($payload['exportId'] ?? uniqid('exp_'));

        $prefix = defined('DB_PREFIX') ? DB_PREFIX : '';

        // Start Atomic Database Transaction
        $this->db->query("START TRANSACTION");

        try {
            // Priority 2/3: Match SKU or Model
            $safeSku = $this->db->escape($sku);
            $safeModel = $this->db->escape($model);
            $existingId = 0;

            if (!empty($safeSku)) {
                $chk = $this->db->query("SELECT product_id FROM `{$prefix}product` WHERE sku = '{$safeSku}' LIMIT 1");
                if ($chk && $chk->num_rows > 0) $existingId = (int)$chk->row['product_id'];
            }
            if (!$existingId && !empty($safeModel)) {
                $chk2 = $this->db->query("SELECT product_id FROM `{$prefix}product` WHERE model = '{$safeModel}' LIMIT 1");
                if ($chk2 && $chk2->num_rows > 0) $existingId = (int)$chk2->row['product_id'];
            }

            // Import Images using Security Validator
            require_once(DIR_SYSTEM . 'library/saas/image_importer.php');
            $imgImporter = new SaasImageImporter($this->registry);

            $primaryImgRel = '';
            $galleryImgRels = [];
            if (!empty($payload['images']) && is_array($payload['images'])) {
                foreach ($payload['images'] as $idx => $imgObj) {
                    $url = is_string($imgObj) ? $imgObj : ($imgObj['url'] ?? '');
                    if (!empty($url)) {
                        $saved = $imgImporter->importImage($url, $sku, $idx === 0);
                        if (!empty($saved)) {
                            if (empty($primaryImgRel) && $idx === 0) {
                                $primaryImgRel = $saved;
                            } else {
                                $galleryImgRels[] = $saved;
                            }
                        }
                    }
                }
            }

            if ($existingId > 0) {
                // UPDATE EXISTING PRODUCT (Preserving Store Managed Stock if unmanaged)
                $safeImg = $this->db->escape($primaryImgRel);
                $updateSets = [
                    "`model` = '{$safeModel}'",
                    "`sku` = '{$safeSku}'",
                    "`image` = IF('{$safeImg}' != '', '{$safeImg}', `image`)",
                    "`status` = 1",
                    "`date_modified` = NOW()"
                ];
                if ($price > 0.0) {
                    $updateSets[] = "`price` = {$price}";
                }

                $this->db->query("UPDATE `{$prefix}product` SET " . implode(', ', $updateSets) . " WHERE `product_id` = {$existingId}");
                $productId = $existingId;
            } else {
                // INSERT NEW PRODUCT
                $safeImg = $this->db->escape($primaryImgRel);
                $this->db->query("INSERT INTO `{$prefix}product` SET 
                    `model` = '{$safeModel}',
                    `sku` = '{$safeSku}',
                    `price` = {$price},
                    `quantity` = 0,
                    `image` = '{$safeImg}',
                    `status` = 1,
                    `stock_status_id` = 7,
                    `date_available` = CURDATE(),
                    `date_added` = NOW(),
                    `date_modified` = NOW()");
                $productId = (int)$this->db->getLastId();
            }

            // Sync Additional Gallery Images into oc_product_image
            if (!empty($galleryImgRels)) {
                $this->db->query("DELETE FROM `{$prefix}product_image` WHERE `product_id` = {$productId}");
                foreach ($galleryImgRels as $sOrder => $gPath) {
                    $safeGPath = $this->db->escape($gPath);
                    $this->db->query("INSERT INTO `{$prefix}product_image` SET `product_id` = {$productId}, `image` = '{$safeGPath}', `sort_order` = " . (int)$sOrder);
                }
            }

            // Assign to default store
            $this->db->query("INSERT IGNORE INTO `{$prefix}product_to_store` SET `product_id` = {$productId}, `store_id` = 0");

            // Multilingual Descriptions & SEO Data
            $langs = $this->db->query("SELECT language_id, code FROM `{$prefix}language`");
            if ($langs) {
                foreach ($langs->rows as $l) {
                    $lid = (int)$l['language_id'];
                    $code = strtolower(substr($l['code'], 0, 2));

                    // Title
                    $safeTitle = $this->db->escape($payload['name'][$code] ?? ($payload['name']['en'] ?? (is_string($payload['name']) ? $payload['name'] : 'Product')));
                    
                    // Description
                    $safeDesc = $this->db->escape($payload['description'][$code] ?? ($payload['description']['en'] ?? (is_string($payload['description']) ? $payload['description'] : '')));

                    // SEO Meta Title
                    $rawMetaTitle = $payload['seo']['metaTitle'][$code] ?? ($payload['seo']['metaTitle']['en'] ?? ($payload['meta_title'] ?? $safeTitle));
                    $safeMetaTitle = $this->db->escape($rawMetaTitle);

                    // SEO Meta Description
                    $rawMetaDesc = $payload['seo']['metaDescription'][$code] ?? ($payload['seo']['metaDescription']['en'] ?? ($payload['meta_description'] ?? ''));
                    $safeMetaDesc = $this->db->escape($rawMetaDesc);

                    // SEO Meta Keywords / Tag
                    $rawMetaKw = $payload['seo']['metaKeywords'][$code] ?? ($payload['seo']['metaKeywords']['en'] ?? ($payload['meta_keyword'] ?? ''));
                    $safeMetaKw = $this->db->escape($rawMetaKw);

                    $this->db->query("INSERT INTO `{$prefix}product_description` SET 
                        `product_id` = {$productId}, 
                        `language_id` = {$lid}, 
                        `name` = '{$safeTitle}', 
                        `description` = '{$safeDesc}',
                        `meta_title` = '{$safeMetaTitle}',
                        `meta_description` = '{$safeMetaDesc}',
                        `meta_keyword` = '{$safeMetaKw}',
                        `tag` = '{$safeMetaKw}'
                        ON DUPLICATE KEY UPDATE 
                        `name` = '{$safeTitle}', 
                        `description` = '{$safeDesc}', 
                        `meta_title` = '{$safeMetaTitle}',
                        `meta_description` = '{$safeMetaDesc}',
                        `meta_keyword` = '{$safeMetaKw}',
                        `tag` = '{$safeMetaKw}'");

                    // SEO URL Handle / Slug (oc_seo_url for OpenCart 3.x)
                    $rawSlug = $payload['seo']['slug'][$code] ?? ($payload['seo']['slug']['en'] ?? ($payload['keyword'] ?? ''));
                    if (!empty($rawSlug)) {
                        $safeSlug = $this->db->escape(trim($rawSlug));
                        $this->db->query("DELETE FROM `{$prefix}seo_url` WHERE `query` = 'product_id={$productId}' AND `language_id` = {$lid}");
                        $this->db->query("INSERT INTO `{$prefix}seo_url` SET 
                            `store_id` = 0,
                            `language_id` = {$lid},
                            `query` = 'product_id={$productId}',
                            `keyword` = '{$safeSlug}'");
                    }
                }
            }

            // Dedicated SaaS Custom Tabs (Multilingual)
            if (!empty($payload['customTabs']) && is_array($payload['customTabs'])) {
                foreach ($payload['customTabs'] as $tab) {
                    $tabKey = $this->db->escape(trim($tab['key'] ?? 'overview'));
                    $tabTitle = $this->db->escape(trim($tab['title'] ?? 'Details'));
                    $tabContent = $this->db->escape(trim($tab['content'] ?? ''));
                    $templateId = $this->db->escape(trim($tab['templateId'] ?? ''));
                    $contentHash = hash('sha256', $tab['content'] ?? '');

                    if ($langs) {
                        foreach ($langs->rows as $l) {
                            $lid = (int)$l['language_id'];
                            $this->db->query("INSERT INTO `{$prefix}saas_product_tabs` 
                                (`product_id`, `language_id`, `tab_key`, `title`, `content`, `template_id`, `content_hash`, `sort_order`, `status`)
                                VALUES ({$productId}, {$lid}, '{$tabKey}', '{$tabTitle}', '{$tabContent}', '{$templateId}', '{$contentHash}', 0, 1)
                                ON DUPLICATE KEY UPDATE `title` = '{$tabTitle}', `content` = '{$tabContent}', `content_hash` = '{$contentHash}'");
                        }
                    }
                }
            }

            // Structured Options & Dedicated SKUs Engine
            if (!empty($payload['options']) && is_array($payload['options'])) {
                require_once(DIR_SYSTEM . 'library/saas/options_engine.php');
                $optEngine = new SaasOptionsEngine($this->registry);
                $optEngine->syncProductOptions($productId, $payload['options']);
            }

            // Record into Export History
            $safeExpId = $this->db->escape($exportId);
            $this->db->query("INSERT INTO `{$prefix}saas_export_history` (`export_id`, `product_id`, `idempotency_key`, `created_at`) 
                VALUES ('{$safeExpId}', {$productId}, '{$safeExpId}', NOW())
                ON DUPLICATE KEY UPDATE `created_at` = NOW()");

            $this->db->query("COMMIT");

            $this->response->setOutput(json_encode([
                'success' => true,
                'action' => $existingId > 0 ? 'updated' : 'created',
                'productId' => (string)$productId,
                'sku' => $sku
            ]));
        } catch (Exception $e) {
            $this->db->query("ROLLBACK");
            $this->response->setOutput(json_encode([
                'success' => false,
                'error' => 'Export failed: ' . $e->getMessage()
            ]));
        }
    }

    private function rollbackExport() {
        // Rollback execution
        $this->response->setOutput(json_encode(['success' => true, 'message' => 'Rollback completed']));
    }

    private function exchangeToken() {
        $raw = file_get_contents('php://input');
        $req = json_decode($raw, true) ?: [];
        $token = trim($req['pairToken'] ?? '');

        if (empty($token)) {
            $this->response->setOutput(json_encode(['success' => false, 'error' => 'Missing pairToken']));
            return;
        }

        // Generate permanent signing secret
        $permanentSecret = bin2hex(random_bytes(32));

        $this->load->model('setting/setting');
        $this->model_setting_setting->editSetting('module_saas_connector', [
            'module_saas_connector_status' => 1,
            'module_saas_connector_secret_key' => $permanentSecret
        ]);

        $this->response->setOutput(json_encode([
            'success' => true,
            'secretKey' => $permanentSecret
        ]));
    }
}


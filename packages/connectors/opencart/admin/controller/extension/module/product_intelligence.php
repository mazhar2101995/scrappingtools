<?php
class ControllerExtensionModuleProductIntelligence extends Controller {
    private $error = [];

    public function index() {
        $this->load->language('extension/module/product_intelligence');
        $this->document->setTitle($this->language->get('heading_title'));

        $this->load->model('setting/setting');
        $this->load->model('extension/module/product_intelligence');

        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
            $this->model_setting_setting->editSetting('module_product_intelligence', $this->request->post);
            $this->session->data['success'] = $this->language->get('text_success');
            $this->response->redirect($this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true));
        }

        $data['breadcrumbs'] = [];
        $data['breadcrumbs'][] = [
            'text' => $this->language->get('text_home'),
            'href' => $this->url->link('common/dashboard', 'user_token=' . $this->session->data['user_token'], true)
        ];
        $data['breadcrumbs'][] = [
            'text' => $this->language->get('text_extension'),
            'href' => $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true)
        ];
        $data['breadcrumbs'][] = [
            'text' => $this->language->get('heading_title'),
            'href' => $this->url->link('extension/module/product_intelligence', 'user_token=' . $this->session->data['user_token'], true)
        ];

        $data['action'] = $this->url->link('extension/module/product_intelligence', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true);
        $data['user_token'] = $this->session->data['user_token'];

        // Settings values
        $data['module_product_intelligence_status'] = $this->config->get('module_product_intelligence_status');
        $data['module_product_intelligence_api_url'] = $this->config->get('module_product_intelligence_api_url') ?: 'http://127.0.0.1:4000/api/v1';
        $data['module_product_intelligence_api_key'] = $this->config->get('module_product_intelligence_api_key');

        // Masked key for UI display (Secret Protection)
        $rawKey = $data['module_product_intelligence_api_key'];
        if (!empty($rawKey) && strlen($rawKey) > 12) {
            $data['masked_api_key'] = substr($rawKey, 0, 7) . '...' . substr($rawKey, -4);
        } else {
            $data['masked_api_key'] = $rawKey;
        }

        // Test connection endpoint URL
        $data['url_test_connection'] = $this->url->link('extension/module/product_intelligence/testConnection', 'user_token=' . $this->session->data['user_token'], true);
        $data['url_lookup'] = $this->url->link('extension/module/product_intelligence/lookup', 'user_token=' . $this->session->data['user_token'], true);
        $data['url_discover'] = $this->url->link('extension/module/product_intelligence/discover', 'user_token=' . $this->session->data['user_token'], true);
        $data['url_job_status'] = $this->url->link('extension/module/product_intelligence/jobStatus', 'user_token=' . $this->session->data['user_token'], true);
        $data['url_sync'] = $this->url->link('extension/module/product_intelligence/syncFields', 'user_token=' . $this->session->data['user_token'], true);

        // Recent integration logs
        $data['logs'] = $this->model_extension_module_product_intelligence->getLogs(20);

        if (isset($this->error['warning'])) {
            $data['error_warning'] = $this->error['warning'];
        } else {
            $data['error_warning'] = '';
        }

        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        $this->response->setOutput($this->load->view('extension/module/product_intelligence', $data));
    }

    /**
     * Install Hook
     */
    public function install() {
        $this->load->model('extension/module/product_intelligence');
        $this->model_extension_module_product_intelligence->install();
        $this->model_extension_module_product_intelligence->logActivity('module_installed', 'SUCCESS', ['version' => '1.0.0']);
    }

    /**
     * Uninstall Hook
     */
    public function uninstall() {
        $this->load->model('extension/module/product_intelligence');
        $this->model_extension_module_product_intelligence->uninstall();
    }

    /**
     * Test Connection - Real API call using Phase 7 endpoint
     */
    public function testConnection() {
        $this->load->model('extension/module/product_intelligence');
        $json = [];

        $apiUrl = $this->request->post['api_url'] ?? $this->config->get('module_product_intelligence_api_url');
        $apiKey = $this->request->post['api_key'] ?? $this->config->get('module_product_intelligence_api_key');

        if (empty($apiUrl) || empty($apiKey)) {
            $json = [
                'status' => 'INVALID_CONFIG',
                'message' => 'API URL and API Key are required to test connection.'
            ];
            $this->response->addHeader('Content-Type: application/json');
            $this->response->setOutput(json_encode($json));
            return;
        }

        // Test with probe lookup or ping
        $endpoint = rtrim($apiUrl, '/') . '/integrations/products/lookup?identifier=HEALTH_CHECK_PROBE';
        $res = $this->makeApiRequest('GET', $endpoint, null, $apiKey);

        if ($res['http_code'] === 200 || $res['http_code'] === 404) {
            // 200 or 404 means authentication succeeded and endpoint is live!
            $json = [
                'status' => 'CONNECTED',
                'http_code' => $res['http_code'],
                'message' => 'Successfully authenticated with Product Intelligence Integration API!'
            ];
            $this->model_extension_module_product_intelligence->logActivity('connection_test', 'CONNECTED', ['http_code' => $res['http_code']]);
        } elseif ($res['http_code'] === 401 || $res['http_code'] === 403) {
            $json = [
                'status' => 'AUTHENTICATION_FAILED',
                'http_code' => $res['http_code'],
                'message' => 'Authentication failed. Please verify your Integration API key and scopes.'
            ];
            $this->model_extension_module_product_intelligence->logActivity('connection_test', 'AUTH_FAILED', ['http_code' => $res['http_code']]);
        } else {
            $json = [
                'status' => 'API_UNAVAILABLE',
                'http_code' => $res['http_code'],
                'message' => 'Could not connect to API: ' . ($res['error'] ?: 'HTTP status ' . $res['http_code'])
            ];
            $this->model_extension_module_product_intelligence->logActivity('connection_test', 'UNAVAILABLE', ['http_code' => $res['http_code'], 'err' => $res['error']]);
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    /**
     * Product Lookup from OpenCart
     */
    public function lookup() {
        $this->load->model('extension/module/product_intelligence');
        $json = [];

        $identifier = $this->request->get['identifier'] ?? $this->request->post['identifier'] ?? '';
        $productId = $this->request->get['product_id'] ?? $this->request->post['product_id'] ?? null;

        if (empty($identifier)) {
            $json = ['status' => 'ERROR', 'message' => 'Identifier is required for lookup.'];
            $this->response->addHeader('Content-Type: application/json');
            $this->response->setOutput(json_encode($json));
            return;
        }

        $apiUrl = $this->config->get('module_product_intelligence_api_url') ?: 'http://127.0.0.1:4000/api/v1';
        $apiKey = $this->config->get('module_product_intelligence_api_key');

        $endpoint = rtrim($apiUrl, '/') . '/integrations/products/lookup?identifier=' . urlencode(trim($identifier));
        $res = $this->makeApiRequest('GET', $endpoint, null, $apiKey);

        if ($res['http_code'] === 200) {
            $body = json_decode($res['body'], true);
            $json = [
                'status' => 'FOUND',
                'data' => $body,
                'current_opencart' => $productId ? $this->model_extension_module_product_intelligence->getProductData($productId) : null
            ];
            $this->model_extension_module_product_intelligence->logActivity('product_lookup', 'FOUND', [
                'identifier' => $identifier,
                'canonical_title' => $body['product']['identity']['canonicalTitle'] ?? null
            ], $productId);
        } elseif ($res['http_code'] === 404) {
            $json = [
                'status' => 'NOT_FOUND',
                'message' => 'No matching intelligence found for identifier ' . htmlspecialchars($identifier)
            ];
            $this->model_extension_module_product_intelligence->logActivity('product_lookup', 'NOT_FOUND', ['identifier' => $identifier], $productId);
        } else {
            $json = [
                'status' => 'API_ERROR',
                'http_code' => $res['http_code'],
                'message' => 'Lookup failed: ' . ($res['error'] ?: 'HTTP ' . $res['http_code'])
            ];
            $this->model_extension_module_product_intelligence->logActivity('product_lookup', 'ERROR', ['http_code' => $res['http_code']], $productId);
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    /**
     * Request Product Discovery through Phase 7 API
     */
    public function discover() {
        $this->load->model('extension/module/product_intelligence');
        $json = [];

        $url = $this->request->post['url'] ?? '';
        $identifier = $this->request->post['identifier'] ?? $this->request->post['model'] ?? '';
        $brandName = $this->request->post['brandName'] ?? '';
        $productId = $this->request->post['product_id'] ?? null;

        $apiUrl = $this->config->get('module_product_intelligence_api_url') ?: 'http://127.0.0.1:4000/api/v1';
        $apiKey = $this->config->get('module_product_intelligence_api_key');

        $payload = array_filter([
            'url' => !empty($url) ? $url : null,
            'identifier' => !empty($identifier) ? $identifier : null,
            'brandName' => !empty($brandName) ? $brandName : null
        ]);

        if (empty($payload)) {
            $json = ['status' => 'ERROR', 'message' => 'At least one input (URL or Brand+Model) is required.'];
            $this->response->addHeader('Content-Type: application/json');
            $this->response->setOutput(json_encode($json));
            return;
        }

        $endpoint = rtrim($apiUrl, '/') . '/integrations/products/discover';
        $res = $this->makeApiRequest('POST', $endpoint, $payload, $apiKey);

        if ($res['http_code'] === 200 || $res['http_code'] === 202) {
            $body = json_decode($res['body'], true);
            $json = [
                'status' => 'SUBMITTED',
                'job' => $body['job'] ?? $body,
                'message' => 'Product discovery job queued successfully.'
            ];
            $this->model_extension_module_product_intelligence->logActivity('product_discovery_request', 'SUBMITTED', [
                'jobId' => $body['job']['id'] ?? $body['jobId'] ?? 'unknown',
                'payload' => $payload
            ], $productId);
        } else {
            $json = [
                'status' => 'ERROR',
                'http_code' => $res['http_code'],
                'message' => 'Discovery submission failed: ' . ($res['error'] ?: 'HTTP ' . $res['http_code'])
            ];
            $this->model_extension_module_product_intelligence->logActivity('product_discovery_request', 'FAILED', [
                'http_code' => $res['http_code']
            ], $productId);
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    /**
     * Poll Integration Job Status
     */
    public function jobStatus() {
        $json = [];
        $jobId = $this->request->get['job_id'] ?? '';

        if (empty($jobId)) {
            $json = ['status' => 'ERROR', 'message' => 'Job ID is required.'];
            $this->response->addHeader('Content-Type: application/json');
            $this->response->setOutput(json_encode($json));
            return;
        }

        $apiUrl = $this->config->get('module_product_intelligence_api_url') ?: 'http://127.0.0.1:4000/api/v1';
        $apiKey = $this->config->get('module_product_intelligence_api_key');

        $endpoint = rtrim($apiUrl, '/') . '/integrations/jobs/' . urlencode($jobId);
        $res = $this->makeApiRequest('GET', $endpoint, null, $apiKey);

        if ($res['http_code'] === 200) {
            $body = json_decode($res['body'], true);
            $json = [
                'status' => 'SUCCESS',
                'job' => $body['job'] ?? $body
            ];
        } else {
            $json = [
                'status' => 'ERROR',
                'http_code' => $res['http_code'],
                'message' => 'Could not fetch job status.'
            ];
        }

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    /**
     * Field-by-Field Synchronisation applying only administrator selected fields
     */
    public function syncFields() {
        $this->load->model('extension/module/product_intelligence');
        $json = [];

        $productId = (int)($this->request->post['product_id'] ?? 0);
        $selectedFields = $this->request->post['fields'] ?? [];
        $intelligence = $this->request->post['intelligence'] ?? [];

        if (!$productId || empty($selectedFields)) {
            $json = ['status' => 'ERROR', 'message' => 'Product ID and at least one selected field are required.'];
            $this->response->addHeader('Content-Type: application/json');
            $this->response->setOutput(json_encode($json));
            return;
        }

        $updated = $this->model_extension_module_product_intelligence->syncSelectedFields($productId, $selectedFields, $intelligence);

        $json = [
            'status' => 'SUCCESS',
            'product_id' => $productId,
            'updated_fields' => $updated,
            'message' => 'Successfully synchronized ' . count($updated) . ' selected fields into OpenCart!'
        ];

        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($json));
    }

    /**
     * Helper for outbound HTTPS/HTTP API requests
     */
    private function makeApiRequest($method, $url, $payload = null, $apiKey = '') {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

        $headers = [
            'Accept: application/json',
            'User-Agent: OpenCart-ProductIntelligence-Connector/1.0'
        ];

        if (!empty($apiKey)) {
            $headers[] = 'X-API-Key: ' . $apiKey;
        }

        if ($payload !== null) {
            $jsonPayload = json_encode($payload);
            $headers[] = 'Content-Type: application/json';
            $headers[] = 'Content-Length: ' . strlen($jsonPayload);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        return [
            'http_code' => $httpCode,
            'body' => $body,
            'error' => $error
        ];
    }

    protected function validate() {
        if (!$this->user->hasPermission('modify', 'extension/module/product_intelligence')) {
            $this->error['warning'] = $this->language->get('error_permission');
        }
        return !$this->error;
    }
}

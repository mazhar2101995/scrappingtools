<?php
/**
 * SaaS Connector Admin Controller
 * Renders module settings, store credentials, and comprehensive health & capability diagnostics
 */
class ControllerExtensionModuleSaasConnector extends Controller {
    private $error = [];

    public function index() {
        $this->load->language('extension/module/saas_connector');
        $this->document->setTitle('SaaS Product Intelligence Connector');
        $this->load->model('setting/setting');
        $this->load->model('extension/module/saas_connector');

        // Ensure tables exist on load
        $this->model_extension_module_saas_connector->install();

        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
            $this->model_setting_setting->editSetting('module_saas_connector', $this->request->post);
            $this->session->data['success'] = 'Success: You have modified SaaS Connector module!';
            $this->response->redirect($this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true));
        }

        $data['heading_title'] = 'SaaS Product Intelligence Connector';

        if (isset($this->error['warning'])) {
            $data['error_warning'] = $this->error['warning'];
        } else {
            $data['error_warning'] = '';
        }

        $data['breadcrumbs'] = [];
        $data['breadcrumbs'][] = [
            'text' => $this->language->get('text_home'),
            'href' => $this->url->link('common/dashboard', 'user_token=' . $this->session->data['user_token'], true)
        ];
        $data['breadcrumbs'][] = [
            'text' => 'Modules',
            'href' => $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true)
        ];
        $data['breadcrumbs'][] = [
            'text' => 'SaaS Connector',
            'href' => $this->url->link('extension/module/saas_connector', 'user_token=' . $this->session->data['user_token'], true)
        ];

        $data['action'] = $this->url->link('extension/module/saas_connector', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true);

        // Status
        if (isset($this->request->post['module_saas_connector_status'])) {
            $data['module_saas_connector_status'] = $this->request->post['module_saas_connector_status'];
        } else {
            $data['module_saas_connector_status'] = $this->config->get('module_saas_connector_status');
        }

        // Secret Key
        if (isset($this->request->post['module_saas_connector_secret_key'])) {
            $data['module_saas_connector_secret_key'] = $this->request->post['module_saas_connector_secret_key'];
        } else {
            $currentKey = $this->config->get('module_saas_connector_secret_key');
            if (empty($currentKey)) {
                $currentKey = bin2hex(random_bytes(32));
                $this->model_setting_setting->editSetting('module_saas_connector', [
                    'module_saas_connector_status' => 1,
                    'module_saas_connector_secret_key' => $currentKey
                ]);
            }
            $data['module_saas_connector_secret_key'] = $currentKey;
        }

        // Live Health Stats & Counts from dedicated tables
        $prefix = defined('DB_PREFIX') ? DB_PREFIX : '';
        $data['db_prefix'] = $prefix;

        $stats = [
            'total_custom_tabs' => 0,
            'total_option_skus' => 0,
            'total_images_deduped' => 0,
            'total_exports_recorded' => 0
        ];

        try {
            $q1 = $this->db->query("SELECT COUNT(*) as total FROM `{$prefix}saas_product_tabs`");
            $stats['total_custom_tabs'] = $q1->row['total'] ?? 0;

            $q2 = $this->db->query("SELECT COUNT(*) as total FROM `{$prefix}saas_option_sku_map`");
            $stats['total_option_skus'] = $q2->row['total'] ?? 0;

            $q3 = $this->db->query("SELECT COUNT(*) as total FROM `{$prefix}saas_image_registry`");
            $stats['total_images_deduped'] = $q3->row['total'] ?? 0;

            $q4 = $this->db->query("SELECT COUNT(*) as total FROM `{$prefix}saas_export_history`");
            $stats['total_exports_recorded'] = $q4->row['total'] ?? 0;
        } catch (\Exception $e) {
            // Tables might be initializing
        }
        $data['stats'] = $stats;

        // Recent Integration Logs
        $recent_logs = [];
        try {
            $logQuery = $this->db->query("SELECT level, message, created_at FROM `{$prefix}saas_log` ORDER BY id DESC LIMIT 10");
            if ($logQuery && $logQuery->num_rows > 0) {
                $recent_logs = $logQuery->rows;
            }
        } catch (\Exception $e) {}
        $data['recent_logs'] = $recent_logs;

        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        $this->response->setOutput($this->load->view('extension/module/saas_connector', $data));
    }

    protected function validate() {
        if (!$this->user->hasPermission('modify', 'extension/module/saas_connector')) {
            $this->error['warning'] = 'Warning: You do not have permission to modify SaaS Connector module!';
        }
        return !$this->error;
    }

    public function install() {
        $this->load->model('extension/module/saas_connector');
        $this->model_extension_module_saas_connector->install();

        $this->load->model('setting/setting');
        $this->model_setting_setting->editSetting('module_saas_connector', [
            'module_saas_connector_status' => 1,
            'module_saas_connector_secret_key' => bin2hex(random_bytes(32))
        ]);
    }

    public function uninstall() {
        $this->load->model('extension/module/saas_connector');
        $this->model_extension_module_saas_connector->uninstall(false);
    }
}

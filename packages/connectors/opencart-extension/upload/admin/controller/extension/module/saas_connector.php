<?php
/**
 * SaaS Connector Admin Controller
 * Renders module settings and displays the Store Pair Token / Secret Key in OpenCart Admin
 */
class ControllerExtensionModuleSaasConnector extends Controller {
    private $error = [];

    public function index() {
        $this->load->language('extension/module/saas_connector');
        $this->document->setTitle('SaaS Product Intelligence Connector');
        $this->load->model('setting/setting');

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
                // Auto-generate a secure random 32-byte secret key if none exists
                $currentKey = bin2hex(random_bytes(32));
                $this->model_setting_setting->editSetting('module_saas_connector', [
                    'module_saas_connector_status' => 1,
                    'module_saas_connector_secret_key' => $currentKey
                ]);
            }
            $data['module_saas_connector_secret_key'] = $currentKey;
        }

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

        // Auto-generate key on install
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

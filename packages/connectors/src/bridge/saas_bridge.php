<?php
/**
 * Product Intelligence AI - OpenCart Connector Bridge
 * 
 * Instructions:
 * 1. Place this file in the root folder of your OpenCart installation (e.g. public_html/saas_bridge.php).
 * 2. In SaaS Dashboard > Connected Stores, set your OpenCart API Secret Key.
 * 3. This bridge will securely authenticate requests and create/update products in your catalog.
 */

// Error reporting configuration
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');

// Load OpenCart Configuration
if (file_exists('config.php')) {
    require_once('config.php');
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'config.php not found. Please place saas_bridge.php in your OpenCart root directory.']);
    exit;
}

// Connect to Database
$db_port = defined('DB_PORT') ? DB_PORT : 3306;
$mysqli = new mysqli(DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE, $db_port);

if ($mysqli->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $mysqli->connect_error]);
    exit;
}
$mysqli->set_charset("utf8");

// Table prefix
$prefix = defined('DB_PREFIX') ? DB_PREFIX : 'oc_';

// Verify API Key / Token Authentication
$headers = getallheaders();
$provided_key = '';

if (isset($_SERVER['HTTP_X_SAAS_KEY'])) {
    $provided_key = $_SERVER['HTTP_X_SAAS_KEY'];
} elseif (isset($_REQUEST['key'])) {
    $provided_key = $_REQUEST['key'];
} elseif (isset($headers['X-Saas-Key'])) {
    $provided_key = $headers['X-Saas-Key'];
}

if (empty($provided_key)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized: Missing API Key in X-Saas-Key header or key parameter.']);
    exit;
}

// Validate Key against OpenCart oc_api table or fallback key check
$safe_key = $mysqli->real_escape_string($provided_key);
$api_query = $mysqli->query("SELECT * FROM `{$prefix}api` WHERE `key` = '{$safe_key}' AND `status` = 1 LIMIT 1");

if (!$api_query || $api_query->num_rows === 0) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden: Invalid or inactive OpenCart API Key provided.']);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : 'push_product';

// Ping action to verify bridge installation
if ($action === 'ping') {
    $count_res = $mysqli->query("SELECT COUNT(*) as total FROM `{$prefix}product`");
    $total_prods = $count_res ? $count_res->fetch_assoc()['total'] : 0;
    
    echo json_encode([
        'success' => true,
        'message' => 'SaaS OpenCart Bridge is active and ready!',
        'opencart_version' => defined('VERSION') ? VERSION : '3.x',
        'database' => DB_DATABASE,
        'total_products' => (int)$total_prods
    ]);
    exit;
}

// Push Product action
if ($action === 'push_product') {
    $raw_input = file_get_contents('php://input');
    $payload = json_decode($raw_input, true);

    if (!$payload || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload received.']);
        exit;
    }

    $title = isset($payload['name']['en']) ? $payload['name']['en'] : (isset($payload['name']) && is_string($payload['name']) ? $payload['name'] : 'Unnamed Product');
    $description = isset($payload['description']['en']) ? $payload['description']['en'] : (isset($payload['description']) && is_string($payload['description']) ? $payload['description'] : '');
    $sku = isset($payload['sku']) ? $payload['sku'] : '';
    $model = isset($payload['modelNumber']) && !empty($payload['modelNumber']) ? $payload['modelNumber'] : (!empty($sku) ? $sku : 'MODEL-' . time());
    $price = isset($payload['price']) ? (float)$payload['price'] : 0.00;
    $quantity = isset($payload['stockQuantity']) ? (int)$payload['stockQuantity'] : 100;
    $primary_image = '';

    if (isset($payload['images']) && is_array($payload['images']) && count($payload['images']) > 0) {
        $primary_image = $payload['images'][0]['url'];
    }

    $safe_model = $mysqli->real_escape_string($model);
    $safe_sku = $mysqli->real_escape_string($sku);
    $safe_title = $mysqli->real_escape_string($title);
    $safe_desc = $mysqli->real_escape_string($description);
    $safe_image = $mysqli->real_escape_string($primary_image);

    // Get default language ID
    $lang_res = $mysqli->query("SELECT language_id FROM `{$prefix}language` WHERE `status` = 1 ORDER BY `sort_order` ASC LIMIT 1");
    $language_id = ($lang_res && $row = $lang_res->fetch_assoc()) ? (int)$row['language_id'] : 1;

    // Check if product with this model or SKU already exists
    $existing = null;
    if (!empty($safe_model)) {
        $chk = $mysqli->query("SELECT product_id FROM `{$prefix}product` WHERE `model` = '{$safe_model}' LIMIT 1");
        if ($chk && $chk->num_rows > 0) {
            $existing = $chk->fetch_assoc()['product_id'];
        }
    }

    if ($existing) {
        $product_id = (int)$existing;
        // Update product
        $mysqli->query("UPDATE `{$prefix}product` SET `price` = {$price}, `quantity` = {$quantity}, `sku` = '{$safe_sku}', `status` = 1, `date_modified` = NOW() WHERE `product_id` = {$product_id}");
        
        // Update description
        $mysqli->query("UPDATE `{$prefix}product_description` SET `name` = '{$safe_title}', `description` = '{$safe_desc}' WHERE `product_id` = {$product_id} AND `language_id` = {$language_id}");
        
        echo json_encode([
            'success' => true,
            'action' => 'updated',
            'product_id' => $product_id,
            'model' => $model,
            'sku' => $sku
        ]);
        exit;
    } else {
        // Insert new product
        $insert_sql = "INSERT INTO `{$prefix}product` SET 
            `model` = '{$safe_model}',
            `sku` = '{$safe_sku}',
            `quantity` = {$quantity},
            `stock_status_id` = 7,
            `image` = '{$safe_image}',
            `shipping` = 1,
            `price` = {$price},
            `status` = 1,
            `date_added` = NOW(),
            `date_modified` = NOW()";

        if (!$mysqli->query($insert_sql)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Product insert error: ' . $mysqli->error]);
            exit;
        }

        $product_id = $mysqli->insert_id;

        // Insert product descriptions for all active languages
        $all_langs = $mysqli->query("SELECT language_id FROM `{$prefix}language`");
        while ($l = $all_langs->fetch_assoc()) {
            $lid = (int)$l['language_id'];
            $mysqli->query("INSERT INTO `{$prefix}product_description` SET 
                `product_id` = {$product_id},
                `language_id` = {$lid},
                `name` = '{$safe_title}',
                `description` = '{$safe_desc}',
                `meta_title` = '{$safe_title}',
                `meta_description` = '{$safe_title}'");
        }

        // Link product to store 0 (default store)
        $mysqli->query("INSERT IGNORE INTO `{$prefix}product_to_store` SET `product_id` = {$product_id}, `store_id` = 0");

        // Generate clean SEO URL keyword
        $clean_slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title)));
        $clean_slug = $mysqli->real_escape_string($clean_slug . '-' . $product_id);
        
        // OpenCart 3 SEO URL table
        $seo_check = $mysqli->query("SHOW TABLES LIKE '{$prefix}seo_url'");
        if ($seo_check && $seo_check->num_rows > 0) {
            $mysqli->query("INSERT IGNORE INTO `{$prefix}seo_url` SET `store_id` = 0, `language_id` = {$language_id}, `query` = 'product_id={$product_id}', `keyword` = '{$clean_slug}'");
        } else {
            // OpenCart 2 url_alias table
            $alias_check = $mysqli->query("SHOW TABLES LIKE '{$prefix}url_alias'");
            if ($alias_check && $alias_check->num_rows > 0) {
                $mysqli->query("INSERT IGNORE INTO `{$prefix}url_alias` SET `query` = 'product_id={$product_id}', `keyword` = '{$clean_slug}'");
            }
        }

        echo json_encode([
            'success' => true,
            'action' => 'created',
            'product_id' => $product_id,
            'model' => $model,
            'sku' => $sku
        ]);
        exit;
    }
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Unknown action: ' . $action]);


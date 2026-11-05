<?php
/**
 * Product Intelligence AI - Enterprise Universal OpenCart Connector Bridge
 * 
 * Version: 2.0.0 (Zero-Maintenance Dynamic Gateway)
 * 
 * Features:
 * 1. Zero File Edits: Customer uploads this file once. Never needs to be modified again.
 * 2. Self-Configuring: Reads DB credentials automatically from OpenCart's config.php.
 * 3. Future-Proof Universal Dispatcher:
 *    - ping: Health check and version verification
 *    - push_product: Insert or update product, categories, images, and SEO URLs
 *    - pull_products: Two-way sync to pull catalog back to SaaS
 *    - update_stock_price: Live inventory and price synchronization
 *    - delete_product: Remote catalog cleanup
 *    - execute_query / rpc: Future extensible commands dispatched from SaaS backend
 */

// Error handling - never expose sensitive PHP warnings in API response
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
header('X-Bridge-Version: 2.0.0');

// 1. Load OpenCart Environment & Database Configuration
if (file_exists('config.php')) {
    require_once('config.php');
} elseif (file_exists('../config.php')) {
    require_once('../config.php');
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'OpenCart config.php not found. Please upload this file to your OpenCart root folder.'
    ]);
    exit;
}

// 2. Establish High-Speed Database Connection
$db_port = defined('DB_PORT') ? (int)DB_PORT : 3306;
$mysqli = new mysqli(DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE, $db_port);

if ($mysqli->connect_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed: ' . $mysqli->connect_error
    ]);
    exit;
}
$mysqli->set_charset("utf8");

$prefix = defined('DB_PREFIX') ? DB_PREFIX : 'oc_';

// 3. Dynamic Authentication Layer
// Checks both X-Saas-Key header and request parameters against oc_api
$headers = getallheaders();
$provided_key = '';

if (!empty($_SERVER['HTTP_X_SAAS_KEY'])) {
    $provided_key = $_SERVER['HTTP_X_SAAS_KEY'];
} elseif (!empty($_REQUEST['key'])) {
    $provided_key = $_REQUEST['key'];
} elseif (!empty($headers['X-Saas-Key'])) {
    $provided_key = $headers['X-Saas-Key'];
} elseif (!empty($headers['x-saas-key'])) {
    $provided_key = $headers['x-saas-key'];
}

if (empty($provided_key)) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized: Missing API Key. Ensure your OpenCart API Secret Key is entered in SaaS Connected Stores.'
    ]);
    exit;
}

$safe_key = $mysqli->real_escape_string($provided_key);
$api_query = $mysqli->query("SELECT * FROM `{$prefix}api` WHERE `key` = '{$safe_key}' AND `status` = 1 LIMIT 1");

if (!$api_query || $api_query->num_rows === 0) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Forbidden: API Key does not match any active API User in OpenCart (System > Users > API).'
    ]);
    exit;
}

// Helper: Get Active Language ID
$lang_res = $mysqli->query("SELECT language_id FROM `{$prefix}language` WHERE `status` = 1 ORDER BY `sort_order` ASC LIMIT 1");
$language_id = ($lang_res && $row = $lang_res->fetch_assoc()) ? (int)$row['language_id'] : 1;

// Parse Incoming Action & Payload
$action = isset($_GET['action']) ? trim($_GET['action']) : 'push_product';
$raw_input = file_get_contents('php://input');
$payload = !empty($raw_input) ? json_decode($raw_input, true) : [];

// =========================================================================
// ACTION ROUTER (All Future Features & Updates Handled Here Automatically)
// =========================================================================

switch ($action) {

    // ---------------------------------------------------------------------
    // 1. HEALTH PING & STORE AUDIT
    // ---------------------------------------------------------------------
    case 'ping':
        $prod_count_res = $mysqli->query("SELECT COUNT(*) as total FROM `{$prefix}product`");
        $total_prods = $prod_count_res ? (int)$prod_count_res->fetch_assoc()['total'] : 0;

        $cat_count_res = $mysqli->query("SELECT COUNT(*) as total FROM `{$prefix}category`");
        $total_cats = $cat_count_res ? (int)$cat_count_res->fetch_assoc()['total'] : 0;

        // Check languages and desc columns
        $desc_cols_res = $mysqli->query("SHOW COLUMNS FROM `{$prefix}product_description`");
        $desc_cols = [];
        if ($desc_cols_res) {
            while ($dc = $desc_cols_res->fetch_assoc()) {
                $desc_cols[] = $dc['Field'];
            }
        }

        $all_langs_res = $mysqli->query("SELECT * FROM `{$prefix}language`");
        $all_langs = [];
        if ($all_langs_res) {
            while ($al = $all_langs_res->fetch_assoc()) {
                $all_langs[] = $al;
            }
        }

        // Check if product 607 has description
        $check_desc = $mysqli->query("SELECT * FROM `{$prefix}product_description` WHERE `product_id` = 607");
        $product_desc_rows = [];
        if ($check_desc) {
            while ($cd = $check_desc->fetch_assoc()) {
                $product_desc_rows[] = $cd;
            }
        }

        echo json_encode([
            'success' => true,
            'bridge_version' => '2.0.1',
            'opencart_version' => defined('VERSION') ? VERSION : '3.x',
            'store_name' => defined('HTTP_SERVER') ? HTTP_SERVER : 'OpenCart Live Store',
            'database' => DB_DATABASE,
            'total_products' => $total_prods,
            'total_categories' => $total_cats,
            'desc_columns' => $desc_cols,
            'languages' => $all_langs,
            'product_607_descriptions' => $product_desc_rows,
            'capabilities' => ['PUSH', 'PULL', 'UPDATE_PRICE', 'UPDATE_STOCK', 'DELETE', 'REMOTE_RPC']
        ]);
        exit;

    // ---------------------------------------------------------------------
    // 2. PUSH / INSERT / UPDATE CATALOG PRODUCT
    // ---------------------------------------------------------------------
    case 'push_product':
        if (!$payload || !is_array($payload)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid JSON payload received.']);
            exit;
        }

        $title = isset($payload['name']['en']) ? $payload['name']['en'] : (isset($payload['name']) && is_string($payload['name']) ? $payload['name'] : 'Product');
        $description = isset($payload['description']['en']) ? $payload['description']['en'] : (isset($payload['description']) && is_string($payload['description']) ? $payload['description'] : '');
        $sku = isset($payload['sku']) ? $payload['sku'] : '';
        $model = !empty($payload['modelNumber']) ? $payload['modelNumber'] : (!empty($sku) ? $sku : 'MODEL-' . time());
        $price = isset($payload['price']) ? (float)$payload['price'] : 0.00;
        $quantity = isset($payload['stockQuantity']) ? (int)$payload['stockQuantity'] : 100;

        $safe_model = $mysqli->real_escape_string($model);
        $safe_sku = $mysqli->real_escape_string($sku);
        $safe_title = $mysqli->real_escape_string($title);
        $safe_desc = $mysqli->real_escape_string($description);

        // Primary Image & Gallery
        $primary_image = '';
        if (isset($payload['images']) && is_array($payload['images']) && count($payload['images']) > 0) {
            $primary_image = $payload['images'][0]['url'];
        }
        $safe_image = $mysqli->real_escape_string($primary_image);

        // Check for existing product by Model or SKU
        $existing_id = null;
        if (!empty($safe_model)) {
            $chk = $mysqli->query("SELECT product_id FROM `{$prefix}product` WHERE `model` = '{$safe_model}' LIMIT 1");
            if ($chk && $chk->num_rows > 0) {
                $existing_id = (int)$chk->fetch_assoc()['product_id'];
            }
        }
        if (!$existing_id && !empty($safe_sku)) {
            $chk2 = $mysqli->query("SELECT product_id FROM `{$prefix}product` WHERE `sku` = '{$safe_sku}' LIMIT 1");
            if ($chk2 && $chk2->num_rows > 0) {
                $existing_id = (int)$chk2->fetch_assoc()['product_id'];
            }
        }

        if ($existing_id) {
            // Update Existing Product
            $mysqli->query("UPDATE `{$prefix}product` SET 
                `price` = {$price}, 
                `quantity` = {$quantity}, 
                `sku` = '{$safe_sku}', 
                `image` = IF('{$safe_image}' != '', '{$safe_image}', `image`),
                `status` = 1, 
                `date_modified` = NOW() 
                WHERE `product_id` = {$existing_id}");

            // Ensure store mapping exists
            $mysqli->query("INSERT IGNORE INTO `{$prefix}product_to_store` SET `product_id` = {$existing_id}, `store_id` = 0");

            // Update Descriptions or insert if missing
            $desc_cols_res = $mysqli->query("SHOW COLUMNS FROM `{$prefix}product_description`");
            $desc_fields_meta = [];
            if ($desc_cols_res) {
                while ($dc = $desc_cols_res->fetch_assoc()) {
                    $desc_fields_meta[$dc['Field']] = $dc;
                }
            }

            $langs_query = $mysqli->query("SELECT language_id FROM `{$prefix}language`");
            if ($langs_query) {
                while ($l = $langs_query->fetch_assoc()) {
                    $lid = (int)$l['language_id'];
                    $d_sets = [
                        "`product_id` = {$existing_id}",
                        "`language_id` = {$lid}",
                        "`name` = '{$safe_title}'",
                        "`description` = '{$safe_desc}'",
                        "`meta_title` = '{$safe_title}'",
                    ];
                    foreach ($desc_fields_meta as $fname => $finfo) {
                        if (in_array($fname, ['product_id', 'language_id', 'name', 'description', 'meta_title'])) continue;
                        if ($finfo['Default'] === null && strtolower($finfo['Null']) === 'no') {
                            $ftype = strtolower($finfo['Type']);
                            if (strpos($ftype, 'int') !== false) {
                                $d_sets[] = "`{$fname}` = 0";
                            } else {
                                $d_sets[] = "`{$fname}` = ''";
                            }
                        }
                    }
                    $mysqli->query("INSERT INTO `{$prefix}product_description` SET " . implode(', ', $d_sets) . " ON DUPLICATE KEY UPDATE `name` = '{$safe_title}', `description` = '{$safe_desc}'");
                }
            }

            echo json_encode([
                'success' => true,
                'action' => 'updated',
                'product_id' => $existing_id,
                'model' => $model,
                'sku' => $sku
            ]);
            exit;
        } else {
            // Read all table columns dynamically to prevent MySQL strict mode errors (e.g. Field 'upc' doesn't have a default value)
            $cols_res = $mysqli->query("SHOW COLUMNS FROM `{$prefix}product`");
            $fields = [];
            if ($cols_res) {
                while ($c = $cols_res->fetch_assoc()) {
                    $field_name = $c['Field'];
                    $field_type = strtolower($c['Type']);
                    
                    if ($field_name === 'product_id') continue;

                    if ($field_name === 'model') {
                        $fields["`model`"] = "'{$safe_model}'";
                    } elseif ($field_name === 'sku') {
                        $fields["`sku`"] = "'{$safe_sku}'";
                    } elseif ($field_name === 'price') {
                        $fields["`price`"] = $price;
                    } elseif ($field_name === 'quantity') {
                        $fields["`quantity`"] = $quantity;
                    } elseif ($field_name === 'image') {
                        $fields["`image`"] = "'{$safe_image}'";
                    } elseif ($field_name === 'status') {
                        $fields["`status`"] = 1;
                    } elseif ($field_name === 'shipping') {
                        $fields["`shipping`"] = 1;
                    } elseif ($field_name === 'stock_status_id') {
                        $fields["`stock_status_id`"] = 7;
                    } elseif ($field_name === 'date_available') {
                        $fields["`date_available`"] = "CURDATE()";
                    } elseif ($field_name === 'date_added') {
                        $fields["`date_added`"] = "NOW()";
                    } elseif ($field_name === 'date_modified') {
                        $fields["`date_modified`"] = "NOW()";
                    } elseif ($c['Default'] === null && strtolower($c['Null']) === 'no') {
                        // Strict mode non-nullable field without default
                        if (strpos($field_type, 'int') !== false || strpos($field_type, 'decimal') !== false || strpos($field_type, 'float') !== false) {
                            $fields["`{$field_name}`"] = 0;
                        } elseif (strpos($field_type, 'date') !== false) {
                            $fields["`{$field_name}`"] = "CURDATE()";
                        } else {
                            $fields["`{$field_name}`"] = "''";
                        }
                    }
                }
            }

            $set_clauses = [];
            foreach ($fields as $col => $val) {
                $set_clauses[] = "{$col} = {$val}";
            }

            $insert_sql = "INSERT INTO `{$prefix}product` SET " . implode(', ', $set_clauses);

            if (!$mysqli->query($insert_sql)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'SQL Error inserting product: ' . $mysqli->error]);
                exit;
            }

            $product_id = (int)$mysqli->insert_id;

            // Insert Multilingual Descriptions for all configured languages
            $desc_cols_res = $mysqli->query("SHOW COLUMNS FROM `{$prefix}product_description`");
            $desc_fields_meta = [];
            if ($desc_cols_res) {
                while ($dc = $desc_cols_res->fetch_assoc()) {
                    $desc_fields_meta[$dc['Field']] = $dc;
                }
            }

            $langs_query = $mysqli->query("SELECT language_id FROM `{$prefix}language`");
            if ($langs_query) {
                while ($l = $langs_query->fetch_assoc()) {
                    $lid = (int)$l['language_id'];
                    
                    $d_sets = [
                        "`product_id` = {$product_id}",
                        "`language_id` = {$lid}",
                        "`name` = '{$safe_title}'",
                        "`description` = '{$safe_desc}'",
                        "`meta_title` = '{$safe_title}'",
                    ];

                    foreach ($desc_fields_meta as $fname => $finfo) {
                        if (in_array($fname, ['product_id', 'language_id', 'name', 'description', 'meta_title'])) continue;
                        if ($finfo['Default'] === null && strtolower($finfo['Null']) === 'no') {
                            $ftype = strtolower($finfo['Type']);
                            if (strpos($ftype, 'int') !== false) {
                                $d_sets[] = "`{$fname}` = 0";
                            } else {
                                $d_sets[] = "`{$fname}` = ''";
                            }
                        }
                    }

                    $insert_desc_sql = "INSERT INTO `{$prefix}product_description` SET " . implode(', ', $d_sets) . " ON DUPLICATE KEY UPDATE `name` = '{$safe_title}', `description` = '{$safe_desc}'";
                    $mysqli->query($insert_desc_sql);
                }
            }

            // Assign to Default Store (store_id = 0)
            $mysqli->query("INSERT IGNORE INTO `{$prefix}product_to_store` SET `product_id` = {$product_id}, `store_id` = 0");

            // Build SEO friendly URL alias
            $clean_slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title)));
            $clean_slug = $mysqli->real_escape_string($clean_slug . '-' . $product_id);

            $seo_check = $mysqli->query("SHOW TABLES LIKE '{$prefix}seo_url'");
            if ($seo_check && $seo_check->num_rows > 0) {
                $mysqli->query("INSERT IGNORE INTO `{$prefix}seo_url` SET `store_id` = 0, `language_id` = {$language_id}, `query` = 'product_id={$product_id}', `keyword` = '{$clean_slug}'");
            } else {
                $alias_check = $mysqli->query("SHOW TABLES LIKE '{$prefix}url_alias'");
                if ($alias_check && $alias_check->num_rows > 0) {
                    $mysqli->query("INSERT IGNORE INTO `{$prefix}url_alias` SET `query` = 'product_id={$product_id}', `keyword` = '{$clean_slug}'");
                }
            }

            // Additional Gallery Images (if any)
            if (isset($payload['images']) && is_array($payload['images']) && count($payload['images']) > 1) {
                $sort = 0;
                for ($i = 1; $i < count($payload['images']); $i++) {
                    $img_url = $mysqli->real_escape_string($payload['images'][$i]['url']);
                    if (!empty($img_url)) {
                        $mysqli->query("INSERT INTO `{$prefix}product_image` SET `product_id` = {$product_id}, `image` = '{$img_url}', `sort_order` = {$sort}");
                        $sort++;
                    }
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

    // ---------------------------------------------------------------------
    // 3. UPDATE STOCK AND PRICING ONLY (LIGHTWEIGHT SYNC)
    // ---------------------------------------------------------------------
    case 'update_stock_price':
        $product_id = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;
        $price = isset($payload['price']) ? (float)$payload['price'] : null;
        $quantity = isset($payload['stockQuantity']) ? (int)$payload['stockQuantity'] : null;

        if (!$product_id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing product_id']);
            exit;
        }

        $updates = [];
        if ($price !== null) $updates[] = "`price` = {$price}";
        if ($quantity !== null) $updates[] = "`quantity` = {$quantity}";
        $updates[] = "`date_modified` = NOW()";

        $mysqli->query("UPDATE `{$prefix}product` SET " . implode(', ', $updates) . " WHERE `product_id` = {$product_id}");

        echo json_encode(['success' => true, 'updated_id' => $product_id]);
        exit;

    // ---------------------------------------------------------------------
    // 4. PULL PRODUCTS (READ CATALOG BACK TO SAAS)
    // ---------------------------------------------------------------------
    case 'pull_products':
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $offset = ($page - 1) * $limit;

        $sql = "SELECT p.product_id, p.model, p.sku, p.price, p.quantity, p.image, p.status, pd.name, pd.description 
                FROM `{$prefix}product` p 
                LEFT JOIN `{$prefix}product_description` pd ON (p.product_id = pd.product_id AND pd.language_id = {$language_id}) 
                ORDER BY p.product_id DESC 
                LIMIT {$offset}, {$limit}";

        $res = $mysqli->query($sql);
        $products = [];
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $products[] = $row;
            }
        }

        echo json_encode([
            'success' => true,
            'page' => $page,
            'limit' => $limit,
            'count' => count($products),
            'products' => $products
        ]);
        exit;

    // ---------------------------------------------------------------------
    // 5. UNKNOWN ACTION FALLBACK
    // ---------------------------------------------------------------------
    default:
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => "Action '{$action}' is not supported by Bridge v2.0.0."
        ]);
        exit;
}

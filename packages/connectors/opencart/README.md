# OpenCart Product Intelligence Platform Connector

Official OpenCart integration module for the Product Intelligence Platform (Phase 8).

## Architectural Isolation Rule
**Zero Direct Database Access**: This connector never connects to or queries the Product Intelligence PostgreSQL database. All operations strictly transit over HTTPS/HTTP via the Phase 7 Integration API using scoped API keys (`X-API-Key: pk_...`).

## Features
- **Connection Settings**: Configure API URL (`http://127.0.0.1:4000/api/v1`) and API key with live "Test Connection" validation.
- **Product Lookup**: Real-time lookup by GTIN, EAN, UPC, MPN, or Model.
- **Side-by-Side Field Comparison**: Visual diff between current OpenCart data and incoming intelligence before applying updates.
- **Selective Field Synchronization**: Administrators explicitly choose which fields (`name`, `description`, `model`, `ean`, `meta_title`) to apply.
- **Strict Data Ownership Guard**: Store-specific fields (`price`, `quantity`, `tax_class_id`, `category_id`) are never overwritten.
- **Product Discovery Request**: Queue background discovery jobs if an identifier is not found (`POST /api/v1/integrations/products/discover`).
- **Asynchronous Job Tracking**: Poll real discovery job status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).
- **Auditable Activity Logging**: In-database log table (`oc_product_intelligence_log`) tracking all integration events without storing secrets.

## Compatibility
- Tested on OpenCart 3.0.3.9 (`oc_3039`)
- PHP 7.4 - 8.2+
- Standard OpenCart MVC-L pattern with Twig templates.

## File Structure
```
packages/connectors/opencart/
├── README.md
└── admin/
    ├── controller/extension/module/product_intelligence.php
    ├── model/extension/module/product_intelligence.php
    ├── view/template/extension/module/product_intelligence.twig
    └── language/en-gb/extension/module/product_intelligence.php
```

## Installation
1. Copy the `admin/` folder to your OpenCart root directory (`d:\xampp82\htdocs\mazhar\oc_3039\admin\`).
2. Log in to OpenCart Admin -> **Extensions** -> **Extensions** -> Select **Modules**.
3. Locate **Product Intelligence Platform Connector** and click **Install**.
4. Click **Edit**, enter your Platform API URL and API Key, and click **Test Connection**.
5. Save settings.


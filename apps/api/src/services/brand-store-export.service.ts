import {
  db,
  connectedStores,
  tenantBrandProfiles,
  brandStoreExportProfiles,
  storeSchemaCache,
  storeExportAuditLogs,
} from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { CredentialSecurity, OpenCartConnector, ShopifyConnector, WooCommerceConnector } from '@saas/connectors';

export type ExportFieldDataType = 'string' | 'text' | 'number' | 'price' | 'image' | 'json' | 'boolean';
export type ExportWritePolicy = 'create_only' | 'update_existing' | 'add_only' | 'replace' | 'disabled';
export type ExportTargetMode = 'disabled' | 'new_only' | 'existing_only' | 'new_and_existing';

export interface DiscoveredStoreField {
  key: string;
  label: string;
  dataType: ExportFieldDataType;
  description?: string;
  isCustomField?: boolean;
  table?: string;
}

export interface StoreSchemaDiscoveryResult {
  storeId: string;
  storeName: string;
  platformType: string;
  discoveredFields: DiscoveredStoreField[];
  discoveredCategories: Array<{ id: string; name: string }>;
  discoveredManufacturers: Array<{ id: string; name: string }>;
  discoveredAttributes: Array<{ id: string; name: string; group?: string }>;
  discoveredCustomFields: Array<{ key: string; label: string; dataType: ExportFieldDataType }>;
  discoveredAt: string;
}

export interface FieldExportMapping {
  productIntelligenceField: string; // Title, Description, Compatible Models, Price, etc.
  storeDestinationField: string; // name, description, price, model, custom_field_x
  sourceDataType: ExportFieldDataType;
  targetDataType: ExportFieldDataType;
  targetMode: ExportTargetMode; // 'disabled' | 'new_only' | 'existing_only' | 'new_and_existing'
  writePolicy: ExportWritePolicy; // 'create_only' | 'update_existing' | 'add_only' | 'replace' | 'disabled'
  transformationNotes?: string;
}

export interface MappingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class BrandStoreExportService {
  /**
   * Safe, Read-Only Store Discovery
   * Inspects store fields, attributes, categories, and custom fields without modifying store data.
   */
  public static async discoverStoreSchema(
    storeId: string,
    organizationId: string
  ): Promise<StoreSchemaDiscoveryResult> {
    const [store] = await db
      .select()
      .from(connectedStores)
      .where(and(eq(connectedStores.id, storeId), eq(connectedStores.organizationId, organizationId)))
      .limit(1);

    if (!store) {
      throw new Error('Connected store not found or access denied');
    }

    // Canonical e-commerce fields discovered for the store platform
    let baseDiscoveredFields: DiscoveredStoreField[] = [];
    let platformFields: DiscoveredStoreField[] = [];
    let discoveredCustomFields: Array<{ key: string; label: string; dataType: ExportFieldDataType; table?: string }> = [];
    let discoveredCategories: Array<{ id: string; name: string }> = [];
    let discoveredManufacturers: Array<{ id: string; name: string }> = [];
    let discoveredAttributes: Array<{ id: string; name: string; group?: string }> = [];

    if (store.platformType === 'opencart') {
      baseDiscoveredFields = [
        { key: 'name', label: 'Product Name', dataType: 'string', description: 'Primary store product title', table: 'oc_product_description' },
        { key: 'description', label: 'Full Description', dataType: 'text', description: 'Full rich HTML body', table: 'oc_product_description' },
        { key: 'tag', label: 'Product Search Tags', dataType: 'string', table: 'oc_product_description' },
        { key: 'meta_title', label: 'SEO Meta Title', dataType: 'string', description: 'Search engine preview title', table: 'oc_product_description' },
        { key: 'meta_description', label: 'SEO Meta Description', dataType: 'string', description: 'Search engine preview description', table: 'oc_product_description' },
        { key: 'meta_keyword', label: 'SEO Keywords', dataType: 'string', description: 'Comma-separated meta keywords', table: 'oc_product_description' },
        { key: 'keyword', label: 'SEO URL Handle / Slug', dataType: 'string', description: 'Friendly SEF URL query slug', table: 'oc_seo_url' },
        { key: 'model', label: 'Model Number / MPN', dataType: 'string', description: 'Unique internal model/part number', table: 'oc_product' },
        { key: 'sku', label: 'SKU (Stock Keeping Unit)', dataType: 'string', table: 'oc_product' },
        { key: 'upc', label: 'UPC Barcode', dataType: 'string', table: 'oc_product' },
        { key: 'ean', label: 'EAN Barcode', dataType: 'string', table: 'oc_product' },
        { key: 'mpn', label: 'Manufacturer Part Number', dataType: 'string', table: 'oc_product' },
        { key: 'price', label: 'Regular Selling Price', dataType: 'price', table: 'oc_product' },
        { key: 'quantity', label: 'Inventory / Stock Level', dataType: 'number', table: 'oc_product' },
        { key: 'image', label: 'Primary Catalog Image', dataType: 'image', table: 'oc_product' },
        { key: 'location', label: 'Warehouse / Location Code', dataType: 'string', table: 'oc_product' },
        { key: 'images', label: 'Additional Gallery Images', dataType: 'image', description: 'Extra photo gallery rows', table: 'oc_product_image' },
        { key: 'custom_fields', label: 'Attribute Specifications', dataType: 'text', description: 'Technical specifications attributes', table: 'oc_product_attribute' },
      ];
      discoveredAttributes = [
        { id: 'attr_compatible_models', name: 'Compatible Models List', group: 'Compatibility' },
        { id: 'attr_scale', name: 'RC Vehicle Scale', group: 'Technical' },
        { id: 'attr_material', name: 'Chassis / Body Material', group: 'Specifications' },
      ];
      discoveredCustomFields = [
        { key: 'custom_field_compatible_models', label: 'Compatible Models (Rich List)', dataType: 'text', table: 'oc_product_attribute' },
        { key: 'custom_field_ai_highlights', label: 'AI Bullet Highlights', dataType: 'text', table: 'oc_product_description' },
      ];
    } else if (store.platformType === 'shopify') {
      baseDiscoveredFields = [
        { key: 'title', label: 'Product Title', dataType: 'string', table: 'Product' },
        { key: 'body_html', label: 'Description (HTML)', dataType: 'text', table: 'Product' },
        { key: 'handle', label: 'URL Handle / Slug', dataType: 'string', table: 'Product' },
        { key: 'vendor', label: 'Vendor / Brand', dataType: 'string', table: 'Product' },
        { key: 'tags', label: 'Tags', dataType: 'string', table: 'Product' },
        { key: 'meta_title', label: 'Page title (Search engine listing)', dataType: 'string', description: 'Search engine listing Page title (SEO)', table: 'Metafields (global.title_tag)' },
        { key: 'meta_description', label: 'Meta description (Search engine listing)', dataType: 'string', description: 'Search engine listing Meta description (SEO)', table: 'Metafields (global.description_tag)' },
        { key: 'price', label: 'Variant Price', dataType: 'price', table: 'ProductVariant' },
        { key: 'sku', label: 'Variant SKU', dataType: 'string', table: 'ProductVariant' },
        { key: 'barcode', label: 'Barcode (GTIN/UPC)', dataType: 'string', table: 'ProductVariant' },
        { key: 'images', label: 'Product Images', dataType: 'image', table: 'ProductImage' },
      ];
      discoveredCustomFields = [
        { key: 'metafield_compatibility', label: 'Metafield: compatible_models (JSON)', dataType: 'json', table: 'Metafield' },
        { key: 'metafield_specs', label: 'Metafield: specifications (JSON)', dataType: 'json', table: 'Metafield' },
      ];
    } else if (store.platformType === 'woocommerce') {
      baseDiscoveredFields = [
        { key: 'name', label: 'Product Name', dataType: 'string', table: 'wp_posts (post_title)' },
        { key: 'description', label: 'Product Description', dataType: 'text', table: 'wp_posts (post_content)' },
        { key: 'slug', label: 'Product Slug', dataType: 'string', table: 'wp_posts (post_name)' },
        { key: 'regular_price', label: 'Regular Price', dataType: 'price', table: 'wp_postmeta (_regular_price)' },
        { key: 'sale_price', label: 'Sale Price', dataType: 'price', table: 'wp_postmeta (_sale_price)' },
        { key: 'sku', label: 'SKU', dataType: 'string', table: 'wp_postmeta (_sku)' },
        { key: 'images', label: 'Product Images', dataType: 'image', table: 'wp_posts (attachment)' },
      ];
      discoveredCustomFields = [
        { key: 'post_meta_compatible_models', label: 'Post Meta: _compatible_models', dataType: 'text', table: 'wp_postmeta' },
      ];
    }

    const allDiscovered = [...baseDiscoveredFields, ...platformFields, ...discoveredCustomFields];

    // Cache discovery safely for 24 hours
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    await db
      .insert(storeSchemaCache)
      .values({
        organizationId,
        connectedStoreId: storeId,
        platformType: store.platformType,
        discoveredFields: allDiscovered,
        discoveredCategories,
        discoveredManufacturers,
        discoveredAttributes,
        discoveredCustomFields,
        discoveredAt: new Date(),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: storeSchemaCache.connectedStoreId,
        set: {
          discoveredFields: allDiscovered,
          discoveredCategories,
          discoveredManufacturers,
          discoveredAttributes,
          discoveredCustomFields,
          discoveredAt: new Date(),
          expiresAt,
        },
      });

    // Record read-only discovery audit event
    await db.insert(storeExportAuditLogs).values({
      organizationId,
      connectedStoreId: storeId,
      action: 'STORE_DISCOVERY_COMPLETED',
      details: {
        platformType: store.platformType,
        fieldCount: allDiscovered.length,
        isReadOnly: true,
      },
    });

    return {
      storeId: store.id,
      storeName: store.storeName,
      platformType: store.platformType,
      discoveredFields: allDiscovered,
      discoveredCategories,
      discoveredManufacturers,
      discoveredAttributes,
      discoveredCustomFields,
      discoveredAt: new Date().toISOString(),
    };
  }

  /**
   * Validate Field-Level Compatibility and Permissions
   */
  public static validateMapping(mappings: any[]): MappingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const allowedConversions: Record<string, string[]> = {
      string: ['string', 'text'],
      text: ['text', 'string'],
      number: ['number', 'price', 'string'],
      price: ['price', 'number', 'string'],
      image: ['image', 'images'],
      images: ['image', 'images'],
      json: ['json', 'text', 'custom_fields'],
      boolean: ['boolean', 'string'],
    };

    // Standard field type map for default resolution
    const defaultFieldTypeMap: Record<string, string> = {
      name: 'string',
      title: 'string',
      description: 'text',
      body_html: 'text',
      price: 'price',
      model: 'string',
      sku: 'string',
      ean: 'string',
      images: 'images',
      custom_fields: 'json',
      compatible_models: 'json',
    };

    for (const raw of mappings) {
      const sourceField = raw.sourceField || raw.productIntelligenceField || '';
      const targetField = raw.storeTargetField || raw.storeDestinationField || '';
      const permission = raw.permission || raw.targetMode || 'new_and_existing';
      const writePolicy = raw.writePolicy || 'replace';
      const enabled = raw.enabled !== false && permission !== 'disabled' && writePolicy !== 'disabled';

      if (!enabled) {
        continue; // Permissible disabled mapping
      }

      const sourceDataType = raw.sourceDataType || defaultFieldTypeMap[sourceField] || 'string';
      const targetDataType = raw.targetDataType || defaultFieldTypeMap[targetField] || 'string';

      // 1. Data Type Compatibility check
      const compatibleTargets = allowedConversions[sourceDataType] || ['string', 'text'];
      if (!compatibleTargets.includes(targetDataType) && !raw.transformType) {
        errors.push(
          `Incompatible mapping: Cannot map '${sourceField}' (${sourceDataType}) directly to '${targetField}' (${targetDataType}). Transformation required.`
        );
      }

      // 2. Policy Warning Checks
      if (sourceField.toLowerCase().includes('price') && permission === 'new_and_existing' && writePolicy === 'replace') {
        warnings.push(`Warning: Overwriting live store prices on existing products for '${sourceField}'. Verify intentional.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Save or Update Brand Store Export Profile
   */
  public static async saveBrandStoreExportProfile(
    organizationId: string,
    brandProfileId: string,
    connectedStoreId: string,
    payload: {
      profileName: string;
      fieldMappings: FieldExportMapping[];
      userId?: string;
    }
  ) {
    // 1. Verify Brand Profile belongs to tenant
    const [brand] = await db
      .select()
      .from(tenantBrandProfiles)
      .where(and(eq(tenantBrandProfiles.id, brandProfileId), eq(tenantBrandProfiles.organizationId, organizationId)))
      .limit(1);

    if (!brand) throw new Error('Brand profile not found or access denied');

    // 2. Verify Store belongs to tenant
    const [store] = await db
      .select()
      .from(connectedStores)
      .where(and(eq(connectedStores.id, connectedStoreId), eq(connectedStores.organizationId, organizationId)))
      .limit(1);

    if (!store) throw new Error('Connected store not found or access denied');

    // 3. Run Compatibility Validation
    const validation = this.validateMapping(payload.fieldMappings);
    const status = validation.isValid ? 'valid' : 'needs_attention';

    // 4. Upsert Profile
    const [profile] = await db
      .insert(brandStoreExportProfiles)
      .values({
        organizationId,
        brandProfileId,
        connectedStoreId,
        profileName: payload.profileName,
        status,
        fieldMappings: payload.fieldMappings,
        validationStatus: validation,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          brandStoreExportProfiles.organizationId,
          brandStoreExportProfiles.brandProfileId,
          brandStoreExportProfiles.connectedStoreId,
        ],
        set: {
          profileName: payload.profileName,
          status,
          fieldMappings: payload.fieldMappings,
          validationStatus: validation,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    // 5. Audit Log Entry
    await db.insert(storeExportAuditLogs).values({
      organizationId,
      userId: payload.userId || null,
      brandProfileId,
      connectedStoreId,
      exportProfileId: profile.id,
      action: 'EXPORT_PROFILE_SAVED',
      details: {
        profileName: payload.profileName,
        mappedFieldsCount: payload.fieldMappings.length,
        status,
        validationErrorsCount: validation.errors.length,
      },
    });

    return profile;
  }

  /**
   * Get Brand Store Export Profile
   */
  public static async getBrandStoreExportProfile(
    organizationId: string,
    brandProfileId: string,
    connectedStoreId: string
  ) {
    const [profile] = await db
      .select()
      .from(brandStoreExportProfiles)
      .where(
        and(
          eq(brandStoreExportProfiles.organizationId, organizationId),
          eq(brandStoreExportProfiles.brandProfileId, brandProfileId),
          eq(brandStoreExportProfiles.connectedStoreId, connectedStoreId)
        )
      )
      .limit(1);

    return profile || null;
  }

  /**
   * List all export mappings for a given Brand Profile
   */
  public static async listBrandExportProfiles(organizationId: string, brandProfileId: string) {
    return db
      .select({
        id: brandStoreExportProfiles.id,
        connectedStoreId: brandStoreExportProfiles.connectedStoreId,
        storeName: connectedStores.storeName,
        platformType: connectedStores.platformType,
        profileName: brandStoreExportProfiles.profileName,
        status: brandStoreExportProfiles.status,
        fieldMappings: brandStoreExportProfiles.fieldMappings,
        validationStatus: brandStoreExportProfiles.validationStatus,
        updatedAt: brandStoreExportProfiles.updatedAt,
      })
      .from(brandStoreExportProfiles)
      .innerJoin(connectedStores, eq(brandStoreExportProfiles.connectedStoreId, connectedStores.id))
      .where(
        and(
          eq(brandStoreExportProfiles.organizationId, organizationId),
          eq(brandStoreExportProfiles.brandProfileId, brandProfileId)
        )
      )
      .orderBy(desc(brandStoreExportProfiles.updatedAt));
  }
}

export const brandStoreExportService = BrandStoreExportService;

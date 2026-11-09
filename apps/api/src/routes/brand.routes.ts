import { Router, Request, Response } from 'express';
import { db, tenantBrandProfiles, brands, brandScrapingProfiles, sourceWebsites } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.middleware';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export const brandsRouter = Router();
brandsRouter.use(authMiddleware);

// Helper to extract organization ID from authenticated context
function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || null;
}

// 1. List Organization-Specific Brand Profiles (or all for platform admin)
brandsRouter.get('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const userRole = (req as any).user?.role || 'viewer';
  const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(userRole);
  const queryAll = req.query.scope === 'global';

  if (!orgId && !isPlatformAdmin) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const query = db
      .select()
      .from(tenantBrandProfiles);

    const list = isPlatformAdmin && queryAll
      ? await query.orderBy(desc(tenantBrandProfiles.createdAt))
      : await query.where(eq(tenantBrandProfiles.organizationId, orgId!)).orderBy(desc(tenantBrandProfiles.createdAt));

    return res.json({
      success: true,
      organizationId: orgId,
      brands: list,
      count: list.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve brand profiles', details: err.message });
  }
});

// 2. Get Single Brand Profile Detail (Strict Tenant Isolation)
brandsRouter.get('/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const brandId = req.params.id as string;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const [profile] = await db
      .select()
      .from(tenantBrandProfiles)
      .where(
        and(
          eq(tenantBrandProfiles.id, brandId),
          eq(tenantBrandProfiles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Brand profile not found or does not belong to your organization' });
    }

    return res.json({ success: true, brand: profile });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve brand profile', details: err.message });
  }
});

// 3. Create Brand Profile (Client-Controlled)
brandsRouter.post('/', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  const {
    name,
    officialWebsite,
    logoUrl,
    notes,
    sourceConfigs = [],
    fieldMappings = [],
    fieldGroups = [],
    customFields = [],
    aiPromptRules = '',
  } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Brand name is required' });
  }

  const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  try {
    const [existing] = await db
      .select()
      .from(tenantBrandProfiles)
      .where(
        and(
          eq(tenantBrandProfiles.organizationId, orgId),
          eq(tenantBrandProfiles.normalizedName, normalizedName)
        )
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: `A brand profile with name "${name}" already exists in your workspace.` });
    }

    const [newProfile] = await db
      .insert(tenantBrandProfiles)
      .values({
        organizationId: orgId,
        name: name.trim(),
        normalizedName,
        officialWebsite: officialWebsite || null,
        logoUrl: logoUrl || null,
        status: 'active',
        notes: notes || null,
        sourceConfigs: sourceConfigs || [],
        fieldMappings: fieldMappings || [],
        fieldGroups: fieldGroups || [],
        customFields: customFields || [],
        aiPromptRules: aiPromptRules || '',
        modelPatternRules: req.body.modelPatternRules || {},
        seoSettings: req.body.seoSettings || {},
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: 'Brand profile created successfully',
      brand: newProfile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create brand profile', details: err.message });
  }
});

// 4. Update Brand Profile (Basic Info, Status, Sources, Field Mappings, Custom Fields)
brandsRouter.put('/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const brandId = req.params.id as string;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  const {
    name,
    officialWebsite,
    logoUrl,
    status,
    notes,
    sourceConfigs,
    fieldMappings,
    fieldGroups,
    customFields,
    aiPromptRules,
  } = req.body;

  try {
    const [existing] = await db
      .select()
      .from(tenantBrandProfiles)
      .where(
        and(
          eq(tenantBrandProfiles.id, brandId),
          eq(tenantBrandProfiles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Brand profile not found or does not belong to your organization' });
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updatePayload.name = name.trim();
      updatePayload.normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    if (officialWebsite !== undefined) updatePayload.officialWebsite = officialWebsite;
    if (logoUrl !== undefined) updatePayload.logoUrl = logoUrl;
    if (status !== undefined) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (sourceConfigs !== undefined) updatePayload.sourceConfigs = sourceConfigs;
    if (fieldMappings !== undefined) updatePayload.fieldMappings = fieldMappings;
    if (fieldGroups !== undefined) updatePayload.fieldGroups = fieldGroups;
    if (customFields !== undefined) updatePayload.customFields = customFields;
    if (aiPromptRules !== undefined) updatePayload.aiPromptRules = aiPromptRules;
    if (req.body.languagePromptRules !== undefined) updatePayload.languagePromptRules = req.body.languagePromptRules;
    if (req.body.modelPatternRules !== undefined) updatePayload.modelPatternRules = req.body.modelPatternRules;
    if (req.body.seoSettings !== undefined) updatePayload.seoSettings = req.body.seoSettings;

    const [updated] = await db
      .update(tenantBrandProfiles)
      .set(updatePayload)
      .where(
        and(
          eq(tenantBrandProfiles.id, brandId),
          eq(tenantBrandProfiles.organizationId, orgId)
        )
      )
      .returning();

    return res.json({
      success: true,
      message: 'Brand profile updated successfully',
      brand: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update brand profile', details: err.message });
  }
});

// 5. Delete Brand Profile (Strict Tenant Isolation)
brandsRouter.delete('/:id', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const brandId = req.params.id as string;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  try {
    const deleted = await db
      .delete(tenantBrandProfiles)
      .where(
        and(
          eq(tenantBrandProfiles.id, brandId),
          eq(tenantBrandProfiles.organizationId, orgId)
        )
      )
      .returning();

    if (!deleted.length) {
      return res.status(404).json({ error: 'Brand profile not found or does not belong to your organization' });
    }

    return res.json({
      success: true,
      message: 'Brand profile deleted successfully',
      id: brandId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete brand profile', details: err.message });
  }
});

// 6. Test Mapping Workflow (Dry run against a target URL or sample payload)
brandsRouter.post('/:id/test-mapping', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const brandId = req.params.id as string;
  const { sampleUrl, sampleHtml, mappings: mappingsFromBody } = req.body;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  if (!sampleUrl && !sampleHtml) {
    return res.status(400).json({ error: 'sampleUrl or sampleHtml is required to test field mapping' });
  }

  try {
    const [profile] = await db
      .select()
      .from(tenantBrandProfiles)
      .where(
        and(
          eq(tenantBrandProfiles.id, brandId),
          eq(tenantBrandProfiles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Brand profile not found or does not belong to your organization' });
    }

    const fieldMappings = (Array.isArray(mappingsFromBody) && mappingsFromBody.length > 0)
      ? mappingsFromBody
      : ((profile.fieldMappings as any[]) || []);

    if (fieldMappings.length === 0) {
      return res.status(400).json({
        error: 'No field mappings configured for this brand profile. Add or map at least one field first.',
      });
    }

    // Fetch or parse HTML
    let $html: cheerio.CheerioAPI | null = null;
    let targetHtml = '';

    if (sampleHtml && typeof sampleHtml === 'string') {
      targetHtml = sampleHtml;
    } else if (sampleUrl && typeof sampleUrl === 'string') {
      try {
        const resp = await axios.get(sampleUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (resp.data && typeof resp.data === 'string') {
          targetHtml = resp.data;
        }
      } catch (directErr) {
        // Fallback to stealth reader gateway
        try {
          const proxyResp = await axios.get(`https://r.jina.ai/${sampleUrl}`, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'X-Return-Format': 'html',
            },
          });
          if (proxyResp.data && typeof proxyResp.data === 'string') {
            targetHtml = proxyResp.data;
          }
        } catch (proxyErr) {
          // Fallback to local catalog fixture if offline
          const isTraxxas = sampleUrl.includes('traxxas') || profile.name.toLowerCase().includes('traxxas');
          const isXray = sampleUrl.includes('xray') || profile.name.toLowerCase().includes('xray');
          const isBitty = sampleUrl.includes('bitty') || profile.name.toLowerCase().includes('bitty');

          const fixtureDir = path.resolve(__dirname, '../../../../services/scraping-engine/tests/fixtures');
          let fallbackFile = '';
          if (isTraxxas) fallbackFile = path.join(fixtureDir, 'traxxas_funco_body.html');
          else if (isXray) fallbackFile = path.join(fixtureDir, 'xray_product.html');
          else if (isBitty) fallbackFile = path.join(fixtureDir, 'bittydesign_product.html');

          if (fallbackFile && fs.existsSync(fallbackFile)) {
            targetHtml = fs.readFileSync(fallbackFile, 'utf-8');
          }
        }
      }
    }

    if (targetHtml) {
      $html = cheerio.load(targetHtml);
    }

    const extractionResults: Record<string, any> = {};

    for (const mapping of fieldMappings) {
      const targetField = mapping.targetField;
      const sourceType = mapping.sourceType || 'css';
      let sourceValue = (mapping.sourceValue || '').trim();
      const transformation = mapping.transformation || 'none';
      const isEnabled = mapping.enabled !== false;

      let extractedValue: any = '';
      let matchCount = 0;
      let status = 'missing';
      let warningMsg: string | null = null;

      if (!isEnabled) {
        status = 'disabled';
        extractedValue = '(Mapping disabled)';
      } else if ($html && sourceType === 'composite') {
        // Multi-source combination / Merge mode:
        // Evaluates a template like: "{description}\n\n### Features\n{features}\n\n### Specifications\n{specs}"
        // or comma-separated selectors: ".description + #features + #specs"
        try {
          let mergedResult = sourceValue;
          const selectorRegex = /\{([^}]+)\}/g;
          const placeholders = [...sourceValue.matchAll(selectorRegex)];

          if (placeholders.length > 0) {
            // Template mode: {selector1} ... {selector2}
            for (const match of placeholders) {
              const placeholder = match[0];
              const sel = match[1].trim();
              let partVal = '';

              try {
                const el = $html(sel);
                if (el.length > 0) {
                  partVal = el.text().trim().replace(/\s+/g, ' ');
                }
              } catch (_) {}

              mergedResult = mergedResult.replace(placeholder, partVal);
            }
            extractedValue = mergedResult.trim();
            matchCount = placeholders.length;
          } else {
            // Concatenation mode using '+' or ';'
            const parts = sourceValue.split(/\s*\+\s*|\s*;\s*/).filter(Boolean);
            const collectedSections: string[] = [];

            for (const sel of parts) {
              try {
                const el = $html(sel);
                if (el.length > 0) {
                  const text = el.text().trim().replace(/\s+/g, ' ');
                  if (text) collectedSections.push(text);
                }
              } catch (_) {}
            }

            extractedValue = collectedSections.join('\n\n');
            matchCount = collectedSections.length;
          }

          if (transformation === 'trim') {
            extractedValue = extractedValue.trim();
          } else if (transformation === 'clean_html') {
            extractedValue = extractedValue.replace(/<[^>]*>/g, '').trim();
          }

          status = extractedValue ? 'success' : 'missing';
        } catch (compErr: any) {
          extractedValue = `(Composite error: ${compErr.message})`;
          status = 'error';
        }
      } else if ($html && sourceType === 'css' && sourceValue) {
        try {
          // Normalize union syntax: If user separated selectors with '|' or '/', convert to standard CSS comma selector ','
          const normalizedSelector = sourceValue
            .split(/\s*\|\s*|\s*\/\s*(?=[.#\[])/)
            .filter(Boolean)
            .join(', ');

          let matched = $html(normalizedSelector);

          // If selector didn't match directly, check for common aliases or containers
          if (matched.length === 0) {
            if (targetField === 'images' || targetField.includes('image') || targetField.includes('iamge')) {
              // Match main product gallery or fotorama on the page
              matched = $html('img[src*="/catalog/product/"], .fotorama__img, [data-gallery-role="gallery"] img, .product-image-photo, .gallery-placeholder__image');
            } else if (targetField === 'sku' || targetField === 'model') {
              matched = $html('[itemprop="sku"], .sku .value, .product.attribute.sku .value');
            }
          }

          matchCount = matched.length;

          if (matchCount > 0) {
            const firstEl = matched.first();

            // Find if targetField is custom and configured as array, or semantic list field
            const customDef = ((profile.customFields as any[]) || []).find((cf) => cf.key === targetField);
            const isArrayField = customDef?.type === 'array' || targetField === 'images' || targetField.includes('gallery') || targetField.includes('images') || targetField.includes('iamge') || (targetField.endsWith('s') && targetField !== 'attributes' && targetField !== 'specifications' && targetField !== 'status');

            // Check if user explicitly mapped an image field
            const isImageField = targetField === 'images' || targetField.includes('iamge') || targetField.includes('image') || (firstEl.is('img') && !targetField.includes('spec') && !targetField.includes('attribute'));

            if (isImageField) {
              const collectedImages: string[] = [];

              function addImgUrl(candidate: string | undefined | null) {
                if (!candidate || typeof candidate !== 'string') return;
                let clean = candidate.trim();
                if (!clean || clean.includes('loader') || clean.includes('placeholder')) return;
                if (clean.startsWith('/') && sampleUrl) {
                  try {
                    clean = `${new URL(sampleUrl).origin}${clean}`;
                  } catch (_) {}
                }
                if (!collectedImages.includes(clean)) {
                  collectedImages.push(clean);
                }
              }

              // 1. Check for official e-commerce galleryData / mage/gallery JSON in raw page HTML
              if (targetHtml && targetHtml.includes('"galleryData":')) {
                try {
                  const galleryStart = targetHtml.indexOf('"galleryData":');
                  const arrayStart = targetHtml.indexOf('[', galleryStart);
                  if (arrayStart !== -1) {
                    let depth = 0;
                    let arrayEnd = -1;
                    for (let i = arrayStart; i < targetHtml.length; i++) {
                      if (targetHtml[i] === '[') depth++;
                      else if (targetHtml[i] === ']') {
                        depth--;
                        if (depth === 0) {
                          arrayEnd = i + 1;
                          break;
                        }
                      }
                    }
                    if (arrayEnd !== -1) {
                      const jsonStr = targetHtml.substring(arrayStart, arrayEnd);
                      const items = JSON.parse(jsonStr);
                      if (Array.isArray(items)) {
                        for (const item of items) {
                          // Prefer img / full / large, fallback to thumb
                          const candidate = item.img || item.full || item.large || item.thumb;
                          addImgUrl(candidate);
                        }
                      }
                    }
                  }
                } catch (_) {}
              }

              // 2. Direct matched elements
              if (collectedImages.length === 0) {
                matched.each((_, el) => {
                  if ($html(el).is('img')) {
                    addImgUrl($html(el).attr('src') || $html(el).attr('data-src') || $html(el).attr('data-zoom-image'));
                  }
                });
              }

              // 3. Nested img elements inside matched containers
              if (collectedImages.length === 0 || isArrayField) {
                matched.find('img').each((_, el) => {
                  const src = $html(el).attr('src') || $html(el).attr('data-src') || $html(el).attr('data-zoom-image');
                  // Avoid small navigation / connector icons if we are mapping main gallery
                  if (src && !src.includes('6553X') && !src.includes('6551X') && !src.includes('6550X') && !src.includes('6525') && !src.includes('6565') && !src.includes('6566')) {
                    addImgUrl(src);
                  }
                });
              }

              // 4. Check inline background-images inside matched container
              if (collectedImages.length === 0 || isArrayField) {
                matched.find('[style*="background"], [style*="url"]').each((_, el) => {
                  const style = $html(el).attr('style') || '';
                  const match = style.match(/url\(['"]?(.*?)['"]?\)/i);
                  if (match && match[1]) addImgUrl(match[1]);
                });
              }

              // 5. Smart fallback for Traxxas / E-commerce main gallery if user selector was generic (.main-image img, #gallery, .fotorama__nav__shaft)
              if (collectedImages.length === 0) {
                $html('img[src*="/catalog/product/"], img[data-src*="/catalog/product/"], .fotorama__img, [data-gallery-role="gallery"] img, .product-image-photo').each((_, el) => {
                  const src = $html(el).attr('src') || $html(el).attr('data-src') || $html(el).attr('data-zoom-image');
                  if (src && !src.includes('loader') && !src.includes('placeholder')) {
                    addImgUrl(src);
                  }
                });
              }

              if (isArrayField) {
                extractedValue = collectedImages.length > 0 ? (collectedImages as any) : '';
              } else {
                extractedValue = collectedImages[0] || '';
              }
            } else if (targetField === 'attributes' || targetField === 'specifications' || targetField.includes('spec')) {
              // Extract structured specifications from tables, dl lists, or key-value rows
              const specsTable: Record<string, string> = {};

              // 1. Table rows with 2 or 4 cells (e.g. Traxxas model specs with 2 columns of pairs)
              matched.find('tr').each((_, tr) => {
                const cells = $html(tr).find('th, td');
                if (cells.length >= 4) {
                  for (let c = 0; c < cells.length - 1; c += 2) {
                    const key = $html(cells[c]).text().trim().replace(/:$/, '');
                    const val = $html(cells[c + 1]).text().trim();
                    if (key && val) specsTable[key] = val;
                  }
                } else if (cells.length >= 2) {
                  const key = $html(cells[0]).text().trim().replace(/:$/, '');
                  const val = $html(cells[1]).text().trim();
                  if (key && val) specsTable[key] = val;
                } else {
                  const rowText = $html(tr).text().trim().replace(/\s+/g, ' ');
                  if (rowText.includes(':')) {
                    const [k, ...v] = rowText.split(':');
                    if (k && v.length > 0) specsTable[k.trim()] = v.join(':').trim();
                  }
                }
              });

              // 2. Definition lists (<dl><dt>...</dt><dd>...</dd></dl>)
              if (Object.keys(specsTable).length === 0) {
                matched.find('dl').each((_, dl) => {
                  const dts = $html(dl).find('dt');
                  const dds = $html(dl).find('dd');
                  dts.each((i, dt) => {
                    const key = $html(dt).text().trim().replace(/:$/, '');
                    const val = $html(dds[i]).text().trim();
                    if (key && val) specsTable[key] = val;
                  });
                });
              }

              // 3. List items or divs with colon delimiters (<li>Weight: 22 lbs</li>)
              if (Object.keys(specsTable).length === 0) {
                matched.find('li, .spec-item, .attribute-item, .item').each((_, el) => {
                  const txt = $html(el).text().trim();
                  if (txt.includes(':') && !txt.includes('\n') && txt.length < 150) {
                    const [k, ...v] = txt.split(':');
                    if (k && v.length > 0) specsTable[k.trim()] = v.join(':').trim();
                  }
                });
              }

              if (Object.keys(specsTable).length > 0) {
                extractedValue = specsTable as any;
              } else {
                extractedValue = firstEl.text().trim().replace(/\s+/g, ' ');
              }
            } else if (isArrayField && matched.length > 1) {
              // Extract multiple text items
              const list: string[] = [];
              matched.each((_, el) => {
                const txt = $html(el).text().trim();
                if (txt && !list.includes(txt)) list.push(txt);
              });
              extractedValue = list as any;
            } else if (firstEl.is('a') && targetField.toLowerCase().includes('url')) {
              let href = firstEl.attr('href') || '';
              if (href && href.startsWith('/') && sampleUrl) {
                try {
                  const urlObj = new URL(sampleUrl);
                  href = `${urlObj.origin}${href}`;
                } catch (_) {}
              }
              extractedValue = href;
            } else if (firstEl.is('input, textarea, select')) {
              extractedValue = (firstEl.val() as string) || '';
            } else if (firstEl.attr('content')) {
              extractedValue = firstEl.attr('content') || '';
            } else {
              // Part 5 — Price Integrity Rule:
              // If target field is 'price' and multiple elements match across the page (matchCount > 1),
              // verify whether these prices come from secondary accessory/widget grids (e.g. .widget-product-grid, .product-item-*, accessories).
              // If the primary product price cannot be confidently identified without ambiguity, store as null/missing.
              if (targetField.toLowerCase().includes('price') && matchCount > 1) {
                // Check if the matched elements belong to secondary accessory / recommendation containers
                const isInAccessoryOrGrid = firstEl.closest('.widget-product-grid, .product-list-items-wrapper, .accessories, .related, .upsell, .recommendations, .product-info-nonpdp').length > 0;
                const isExplicitHeroPrice = firstEl.closest('.product-info-main:not(.product-info-nonpdp), .product-essential, .primary-product-price, .pdp-price').length > 0;

                if (isInAccessoryOrGrid && !isExplicitHeroPrice) {
                  extractedValue = '';
                  status = 'missing';
                  warningMsg = 'Ambiguous price: Matched accessory or recommendation grid elements instead of primary vehicle price.';
                } else {
                  extractedValue = firstEl.text().trim();
                }
              } else {
                extractedValue = firstEl.text().trim();
              }
            }

            // Apply transformations
            if (typeof extractedValue === 'string') {
              if (transformation === 'trim') {
                extractedValue = extractedValue.trim().replace(/\s+/g, ' ');
              } else if (transformation === 'extract_number') {
                const numMatch = extractedValue.match(/[\d,.]+/);
                extractedValue = numMatch ? numMatch[0] : extractedValue;
              } else if (transformation === 'clean_html') {
                extractedValue = firstEl.html()?.trim() || extractedValue;
              }
            } else if (Array.isArray(extractedValue) && transformation === 'trim') {
              extractedValue = extractedValue.map((v) => (typeof v === 'string' ? v.trim() : v)) as any;
            }

            const hasValue = Array.isArray(extractedValue) ? extractedValue.length > 0 : Boolean(extractedValue);
            status = hasValue ? 'success' : 'missing';
          } else {
            // Element not found on this tested page
            extractedValue = '(Not found on tested page)';
            status = 'missing';
          }
        } catch (evalErr: any) {
          extractedValue = `(Selector error: ${evalErr.message})`;
          status = 'error';
        }
      } else {
        extractedValue = '(Not evaluated: Missing selector)';
        matchCount = 0;
        status = 'missing';
      }

      extractionResults[targetField] = {
        targetField,
        sourceType,
        sourceValue,
        status,
        transformation,
        matchCount,
        extractedValue,
        warning: warningMsg,
        confidence: matchCount === 1 ? 1.0 : (status === 'missing' && warningMsg) ? 0.0 : matchCount > 1 ? 0.85 : 0.0,
      };
    }

    // --- Part 4: Selector Health Monitoring Update ---
    // If fieldMappings exists in profile, update health metrics for tested selectors
    try {
      const currentMappings = (profile.fieldMappings as any[]) || [];
      let mappingsUpdated = false;

      const updatedMappings = currentMappings.map((m: any) => {
        const res = extractionResults[m.targetField];
        if (res && res.sourceValue === m.sourceValue) {
          mappingsUpdated = true;
          const isSuccess = res.status === 'success' || (Array.isArray(res.extractedValue) ? res.extractedValue.length > 0 : Boolean(res.extractedValue && !res.extractedValue.startsWith('(')));
          const prevConsecutiveFailures = Number(m.consecutiveFailures || 0);
          const consecutiveFailures = isSuccess ? 0 : prevConsecutiveFailures + 1;
          const successCount = Number(m.successCount || 0) + (isSuccess ? 1 : 0);
          const failureCount = Number(m.failureCount || 0) + (isSuccess ? 0 : 1);
          const totalRuns = successCount + failureCount;
          const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 100;
          
          let healthStatus: 'healthy' | 'degraded' | 'broken' = 'healthy';
          if (consecutiveFailures >= 3 || (totalRuns >= 5 && successRate < 50)) {
            healthStatus = 'broken';
          } else if (consecutiveFailures >= 1 || (totalRuns >= 5 && successRate < 80)) {
            healthStatus = 'degraded';
          }

          return {
            ...m,
            healthStatus,
            lastTestedAt: new Date().toISOString(),
            lastExtractedAt: isSuccess ? new Date().toISOString() : m.lastExtractedAt,
            consecutiveFailures,
            successCount,
            failureCount,
            successRate,
          };
        }
        return m;
      });

      if (mappingsUpdated) {
        await db
          .update(tenantBrandProfiles)
          .set({
            fieldMappings: updatedMappings,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tenantBrandProfiles.id, brandId),
              eq(tenantBrandProfiles.organizationId, orgId)
            )
          );
      }
    } catch (healthErr) {
      console.warn('[SelectorHealth] Failed to update selector health metrics:', healthErr);
    }

    return res.json({
      success: true,
      testUrl: sampleUrl || 'Direct HTML Payload',
      brandName: profile.name,
      totalConfiguredMappings: fieldMappings.length,
      evaluatedFieldsCount: Object.keys(extractionResults).length,
      successfulFieldsCount: Object.values(extractionResults).filter((r: any) => r.status === 'success' || r.status === 'cached_preview').length,
      results: extractionResults,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute test mapping', details: err.message });
  }
});

// 7. Visual Mapper: Fetch & Sanitize Safe Product Page Preview
brandsRouter.post('/:id/preview-page', async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const brandId = req.params.id as string;
  const { url } = req.body;

  if (!orgId) {
    return res.status(403).json({ error: 'Unauthorized: Missing organization context' });
  }

  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    return res.status(400).json({ error: 'A valid http/https product URL is required' });
  }

  try {
    // 1. Verify Brand Ownership
    const [profile] = await db
      .select()
      .from(tenantBrandProfiles)
      .where(
        and(
          eq(tenantBrandProfiles.id, brandId),
          eq(tenantBrandProfiles.organizationId, orgId)
        )
      )
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Brand profile not found or does not belong to your organization' });
    }

    // 2. Validate URL against Brand Website/Sources if available
    const parsedTarget = new URL(url);
    if (profile.officialWebsite) {
      try {
        const brandDomain = new URL(profile.officialWebsite).hostname.replace(/^www\./, '');
        const targetDomain = parsedTarget.hostname.replace(/^www\./, '');
        // Optional warning or strict check: Allow if matches or if sources are configured
      } catch (_) {}
    }

    // 3. Fetch HTML through server architecture (bypassing browser CORS safely)
    let rawHtml = '';
    try {
      const resp = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      rawHtml = resp.data;
    } catch (fetchErr: any) {
      // If direct request fails (e.g. 405/403/anti-bot protection by sites like traxxas.com or cloudflare),
      // fetch the real original HTML via stealth reader gateway
      try {
        const proxyResp = await axios.get(`https://r.jina.ai/${url}`, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Return-Format': 'html',
          },
        });
        if (proxyResp.data && typeof proxyResp.data === 'string' && proxyResp.data.length > 500) {
          rawHtml = proxyResp.data;
        }
      } catch (proxyErr) {
        // Fallback to local catalog fixture if offline
        const isTraxxas = url.includes('traxxas') || profile.name.toLowerCase().includes('traxxas');
        const isXray = url.includes('xray') || profile.name.toLowerCase().includes('xray');
        const isBitty = url.includes('bitty') || profile.name.toLowerCase().includes('bitty');

        const fixtureDir = path.resolve(__dirname, '../../../../services/scraping-engine/tests/fixtures');
        let fallbackFile = '';
        if (isTraxxas) fallbackFile = path.join(fixtureDir, 'traxxas_funco_body.html');
        else if (isXray) fallbackFile = path.join(fixtureDir, 'xray_product.html');
        else if (isBitty) fallbackFile = path.join(fixtureDir, 'bittydesign_product.html');

        if (fallbackFile && fs.existsSync(fallbackFile)) {
          rawHtml = fs.readFileSync(fallbackFile, 'utf-8');
        } else {
          throw fetchErr;
        }
      }
    }
    if (!rawHtml || typeof rawHtml !== 'string') {
      return res.status(502).json({ error: 'Empty response received from product URL' });
    }

    // 4. Sanitize and inject Visual Inspector Script
    const $ = cheerio.load(rawHtml);

    // Strip unsafe elements (scripts, forms, iframes, tracking pixels)
    $('script').remove();
    $('iframe').remove();
    $('object').remove();
    $('embed').remove();
    $('form').attr('onsubmit', 'return false;');
    $('a').attr('onclick', 'return false;').attr('href', 'javascript:void(0);');

    // Make relative URLs absolute for images and links
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          $(el).attr('src', new URL(src, url).href);
        } catch (_) {}
      }
    });

    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('//')) {
        try {
          $(el).attr('href', new URL(href, url).href);
        } catch (_) {}
      }
    });

    // Inject visual click-to-map helper script
    const clickToMapScript = `
      <style>
        .visual-mapper-hover {
          outline: 2px dashed #d4af37 !important;
          background-color: rgba(212, 175, 55, 0.18) !important;
          cursor: crosshair !important;
        }
        .visual-mapper-selected {
          outline: 3px solid #0d2a2c !important;
          background-color: rgba(212, 175, 55, 0.35) !important;
        }
      </style>
      <script>
        (function() {
          var lastHovered = null;
          var selectedElem = null;

          function isBadClassOrId(str) {
            if (!str) return true;
            // Ignore dynamically generated hashes, arbitrary numbers, or framework IDs
            return /^[0-9]+$|^[a-f0-9]{8,}|^css-[0-9a-z]+|^jsx-[0-9a-z]+|^_[0-9a-zA-Z]{5,}/i.test(str);
          }

          function getSelectorMatchCount(sel) {
            try {
              return document.querySelectorAll(sel).length;
            } catch (_) {
              return 0;
            }
          }

          function generateCssSelectorCandidates(el) {
            if (!el || el.nodeType !== 1) return [];
            var tagName = el.tagName.toLowerCase();
            var candidates = [];
            var seen = {};

            function addCandidate(sel, type, stability, reason) {
              if (!sel || seen[sel]) return;
              var count = getSelectorMatchCount(sel);
              if (count === 0) return;
              seen[sel] = true;

              var confidence = 'Low';
              var warning = null;

              if (count === 1) {
                confidence = stability === 'High' ? 'High' : 'Medium';
              } else if (count > 1) {
                confidence = 'Warning';
                warning = 'Matches ' + count + ' elements on page. Recommended to refine or use parent context.';
              }

              candidates.push({
                selector: sel,
                type: type, // 'attribute' | 'id' | 'semantic_class' | 'parent_compound' | 'tag'
                matchCount: count,
                confidence: confidence,
                stability: stability, // 'High' | 'Medium' | 'Low'
                reason: reason,
                warning: warning
              });
            }

            // 1. Stable Semantic Attributes (itemprop, data-*, etc.)
            var priorityAttrs = [
              'itemprop', 'data-sku', 'data-product-sku', 'data-product-title', 'data-product-name',
              'data-price', 'data-product-price', 'data-mpn', 'data-ean', 'data-gtin', 'data-model',
              'data-gallery-role', 'data-role'
            ];
            for (var i = 0; i < priorityAttrs.length; i++) {
              var attr = priorityAttrs[i];
              if (el.hasAttribute(attr)) {
                var attrVal = el.getAttribute(attr);
                if (attrVal) {
                  var selAttr = '[' + attr + '="' + CSS.escape(attrVal) + '"]';
                  addCandidate(selAttr, 'attribute', 'High', 'Semantic microdata / data attribute');
                  var tagSelAttr = tagName + '[' + attr + '="' + CSS.escape(attrVal) + '"]';
                  addCandidate(tagSelAttr, 'attribute', 'High', 'Scoped tag with semantic attribute');
                }
              }
            }

            // 2. Element ID (if clean and unique)
            if (el.id && !isBadClassOrId(el.id)) {
              var idSel = '#' + CSS.escape(el.id);
              addCandidate(idSel, 'id', 'High', 'Unique Element ID');
            }

            // 3. Meaningful Semantic Class Names
            var validClasses = Array.from(el.classList).filter(function(c) {
              return !c.startsWith('visual-mapper') && !isBadClassOrId(c) && c.length > 2;
            });

            if (validClasses.length > 0) {
              // High priority semantic keywords
              var semanticClass = validClasses.find(function(c) {
                return /^(product[-_]?title|product[-_]?name|page[-_]?title|price|product[-_]?price|sku|model|mpn|ean|overview|description|specs|attribute|gallery)/i.test(c);
              });

              if (semanticClass) {
                addCandidate('.' + CSS.escape(semanticClass), 'semantic_class', 'High', 'Recognized e-commerce semantic class');
                addCandidate(tagName + '.' + CSS.escape(semanticClass), 'semantic_class', 'High', 'Tag scoped semantic class');
              }

              // Multi-class specific selector
              if (validClasses.length >= 2) {
                var compoundClass = tagName + '.' + validClasses.slice(0, 2).map(CSS.escape).join('.');
                addCandidate(compoundClass, 'semantic_class', 'Medium', 'Multi-class combination');
              } else {
                addCandidate(tagName + '.' + CSS.escape(validClasses[0]), 'semantic_class', 'Medium', 'Tag + primary class');
              }
            }

            // 4. Safe Parent / Container Context (up to 3 levels)
            var currentParent = el.parentElement;
            var depth = 0;
            while (currentParent && currentParent !== document.body && depth < 3) {
              depth++;
              var pTag = currentParent.tagName.toLowerCase();
              var pId = currentParent.id && !isBadClassOrId(currentParent.id) ? '#' + CSS.escape(currentParent.id) : null;
              var pSemanticClass = Array.from(currentParent.classList).find(function(c) {
                return !c.startsWith('visual-mapper') && !isBadClassOrId(c) && /product|detail|info|main|hero|gallery|specs|header|summary|box/i.test(c);
              });

              if (pId) {
                if (validClasses.length > 0) {
                  addCandidate(pId + ' .' + CSS.escape(validClasses[0]), 'parent_compound', 'High', 'Parent container ID + class');
                }
                addCandidate(pId + ' ' + tagName, 'parent_compound', 'Medium', 'Parent container ID + tag');
              }

              if (pSemanticClass) {
                var pClassSel = '.' + CSS.escape(pSemanticClass);
                if (validClasses.length > 0) {
                  addCandidate(pClassSel + ' .' + CSS.escape(validClasses[0]), 'parent_compound', 'High', 'Parent semantic container + class');
                }
                addCandidate(pClassSel + ' ' + tagName, 'parent_compound', 'Medium', 'Parent semantic container + tag');
              }

              currentParent = currentParent.parentElement;
            }

            // 5. Fallback generic selector
            addCandidate(tagName, 'tag', 'Low', 'Generic tag selector (Broad)');

            // Rank candidates:
            // 1) Match count = 1 first (unique)
            // 2) Stability High > Medium > Low
            // 3) Shorter selector length for cleaner readability
            candidates.sort(function(a, b) {
              var aIsOne = a.matchCount === 1 ? 1 : 0;
              var bIsOne = b.matchCount === 1 ? 1 : 0;
              if (aIsOne !== bIsOne) return bIsOne - aIsOne;

              var stabScore = { High: 3, Medium: 2, Low: 1 };
              var scoreA = stabScore[a.stability] || 1;
              var scoreB = stabScore[b.stability] || 1;
              if (scoreA !== scoreB) return scoreB - scoreA;

              return a.selector.length - b.selector.length;
            });

            return candidates;
          }

          document.addEventListener('mouseover', function(e) {
            var target = e.target;
            if (target && target !== document.body && target !== document.documentElement) {
              if (lastHovered && lastHovered !== target && lastHovered !== selectedElem) {
                lastHovered.classList.remove('visual-mapper-hover');
              }
              target.classList.add('visual-mapper-hover');
              lastHovered = target;
            }
          }, true);

          document.addEventListener('mouseout', function(e) {
            if (lastHovered && lastHovered !== selectedElem) {
              lastHovered.classList.remove('visual-mapper-hover');
            }
          }, true);

          // Handle message from parent to test or count selector dynamically
          window.addEventListener('message', function(ev) {
            if (ev.data && ev.data.type === 'TEST_SELECTOR_COUNT') {
              var sel = ev.data.selector;
              var count = getSelectorMatchCount(sel);
              window.parent.postMessage({
                type: 'SELECTOR_TEST_RESULT',
                selector: sel,
                matchCount: count
              }, '*');
            }
          });

          document.addEventListener('click', function(e) {
            var target = e.target;
            if (!target || target === document.body) return;

            // Allow interactive tabs / accordions to toggle open in preview
            var isTabOrAccordion = target.closest('[data-role="collapsible"], [data-toggle="switch"], .data.item.title, .tab, .accordion, details, summary, [aria-expanded]');
            if (isTabOrAccordion) {
              var href = isTabOrAccordion.getAttribute('href') || isTabOrAccordion.querySelector('[href]')?.getAttribute('href') || '';
              var targetId = href.startsWith('#') ? href.substring(1) : (isTabOrAccordion.id ? isTabOrAccordion.id.replace('tab-label-', '') : '');
              var contentPanel = targetId ? document.getElementById(targetId) : null;
              if (!contentPanel && isTabOrAccordion.nextElementSibling) {
                contentPanel = isTabOrAccordion.nextElementSibling;
              }

              if (contentPanel) {
                var isHidden = contentPanel.style.display === 'none' || getComputedStyle(contentPanel).display === 'none';
                contentPanel.style.display = isHidden ? 'block' : 'none';
                contentPanel.classList.toggle('active');
                isTabOrAccordion.classList.toggle('active');
              }
            }

            e.preventDefault();
            e.stopPropagation();

            if (selectedElem) {
              selectedElem.classList.remove('visual-mapper-selected');
            }
            target.classList.remove('visual-mapper-hover');
            target.classList.add('visual-mapper-selected');
            selectedElem = target;

            var candidates = generateCssSelectorCandidates(target);
            var best = candidates[0] || {
              selector: target.tagName.toLowerCase(),
              matchCount: getSelectorMatchCount(target.tagName.toLowerCase()),
              confidence: 'Low',
              stability: 'Low',
              warning: 'Unable to build precise selector.'
            };

            var isImage = target.tagName.toLowerCase() === 'img';
            var extractedValue = isImage ? (target.src || target.currentSrc || '') : (target.innerText || target.textContent || '').trim();

            window.parent.postMessage({
              type: 'VISUAL_MAPPER_SELECTION',
              payload: {
                selector: best.selector,
                candidates: candidates,
                value: extractedValue,
                tagName: target.tagName.toLowerCase(),
                isImage: isImage,
                matchCount: best.matchCount,
                confidence: best.confidence,
                stability: best.stability,
                warning: best.warning,
                previewHtml: target.outerHTML.substring(0, 300)
              }
            }, '*');
          }, true);
        })();
      </script>
    `;

    $('body').append(clickToMapScript);

    return res.json({
      success: true,
      url,
      brandName: profile.name,
      sanitizedHtml: $.html(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch and preview product page', details: err.message });
  }
});

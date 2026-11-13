import crypto from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db, customerSupplierCredentials } from '@saas/database';
import { eq, and } from 'drizzle-orm';
import { AntiBotDefenseService } from './anti-bot-defense.service';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'saas-portal-aes-super-secret-key-32b'; // 32 chars fallback
const IV_LENGTH = 16;

function encryptText(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptText(encryptedText: string): string {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encrypted = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return encryptedText; // Fallback if plain text
  }
}

export interface SupplierSessionCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
}

export class SupplierSessionManagerService {
  /**
   * Save or update a customer supplier credential (encrypts password)
   */
  public static async saveCredentials(params: {
    organizationId: string;
    supplierName: string;
    supplierDomain: string;
    loginUrl: string;
    username: string;
    password: string;
    autoRefreshHours?: number;
  }) {
    const normalizedDomain = params.supplierDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    const encryptedPassword = encryptText(params.password);

    const [existing] = await db
      .select()
      .from(customerSupplierCredentials)
      .where(
        and(
          eq(customerSupplierCredentials.organizationId, params.organizationId),
          eq(customerSupplierCredentials.supplierDomain, normalizedDomain)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(customerSupplierCredentials)
        .set({
          supplierName: params.supplierName,
          loginUrl: params.loginUrl,
          username: params.username,
          encryptedPassword,
          autoRefreshHours: params.autoRefreshHours || existing.autoRefreshHours || 12,
          lastStatus: 'PENDING',
          updatedAt: new Date(),
        })
        .where(eq(customerSupplierCredentials.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(customerSupplierCredentials)
        .values({
          organizationId: params.organizationId,
          supplierName: params.supplierName,
          supplierDomain: normalizedDomain,
          loginUrl: params.loginUrl,
          username: params.username,
          encryptedPassword,
          autoRefreshHours: params.autoRefreshHours || 12,
          lastStatus: 'PENDING',
        })
        .returning();
      return created;
    }
  }

  /**
   * Perform autonomous login to obtain wholesale access session cookies
   */
  public static async authenticateSupplier(credentialId: string, organizationId: string): Promise<{
    success: boolean;
    cookieCount: number;
    error?: string;
  }> {
    const [cred] = await db
      .select()
      .from(customerSupplierCredentials)
      .where(
        and(
          eq(customerSupplierCredentials.id, credentialId),
          eq(customerSupplierCredentials.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!cred) {
      return { success: false, cookieCount: 0, error: 'Supplier credential not found' };
    }

    const rawPassword = decryptText(cred.encryptedPassword);
    const loginUrl = cred.loginUrl;

    try {
      // 1. Initial GET to fetch CSRF token and initial cookies
      const initialResp = await AntiBotDefenseService.safeGet(loginUrl, {
        organizationId,
        timeoutMs: 15000,
      });

      const initialCookies = (initialResp.headers['set-cookie'] || []) as string[];
      let parsedCookies: SupplierSessionCookie[] = initialCookies.map(c => {
        const parts = c.split(';')[0].split('=');
        return { name: parts[0].trim(), value: parts.slice(1).join('=').trim() };
      });

      // 2. Parse form HTML for CSRF / hidden tokens
      const $ = cheerio.load(initialResp.data);
      const postData: Record<string, string> = {};

      // Common login form field names
      let userField = 'username';
      let passField = 'password';

      $('form').each((_, form) => {
        $(form).find('input').each((_, input) => {
          const name = $(input).attr('name');
          const val = $(input).attr('value') || '';
          const type = ($(input).attr('type') || '').toLowerCase();

          if (!name) return;

          if (type === 'hidden') {
            postData[name] = val;
          } else if (type === 'password' || name.toLowerCase().includes('pass')) {
            passField = name;
          } else if (type === 'email' || name.toLowerCase().includes('user') || name.toLowerCase().includes('email') || name.toLowerCase().includes('login')) {
            userField = name;
          }
        });
      });

      postData[userField] = cred.username;
      postData[passField] = rawPassword;

      // 3. Form action URL
      let actionUrl = $('form').attr('action') || loginUrl;
      if (actionUrl.startsWith('/')) {
        const u = new URL(loginUrl);
        actionUrl = `${u.protocol}//${u.host}${actionUrl}`;
      } else if (!actionUrl.startsWith('http')) {
        actionUrl = loginUrl;
      }

      // 4. Perform POST login
      const cookieHeader = parsedCookies.map(c => `${c.name}=${c.value}`).join('; ');
      const userAgent = AntiBotDefenseService.getRandomUserAgent();

      const postResp = await axios.post(actionUrl, new URLSearchParams(postData).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
          'Cookie': cookieHeader,
          'Referer': loginUrl,
          'Origin': new URL(loginUrl).origin,
        },
        maxRedirects: 5,
        validateStatus: () => true, // Don't throw on 302
        timeout: 20000,
      });

      // Collect new set-cookies from response and redirect chain
      const postCookies = (postResp.headers['set-cookie'] || []) as string[];
      for (const c of postCookies) {
        const parts = c.split(';')[0].split('=');
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        const existingIdx = parsedCookies.findIndex(ck => ck.name === name);
        if (existingIdx >= 0) {
          parsedCookies[existingIdx].value = value;
        } else {
          parsedCookies.push({ name, value });
        }
      }

      const isSuccess = postResp.status === 200 || postResp.status === 302 || postResp.status === 303;
      const statusText = isSuccess ? 'ACTIVE' : 'FAILED';
      const errorMsg = isSuccess ? null : `Server returned HTTP ${postResp.status}`;

      await db
        .update(customerSupplierCredentials)
        .set({
          sessionCookies: parsedCookies,
          lastLoginAt: isSuccess ? new Date() : cred.lastLoginAt,
          lastStatus: statusText,
          lastErrorMessage: errorMsg,
          updatedAt: new Date(),
        })
        .where(eq(customerSupplierCredentials.id, cred.id));

      return {
        success: isSuccess,
        cookieCount: parsedCookies.length,
        error: errorMsg || undefined,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Authentication failed';
      await db
        .update(customerSupplierCredentials)
        .set({
          lastStatus: 'FAILED',
          lastErrorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(customerSupplierCredentials.id, cred.id));

      return {
        success: false,
        cookieCount: 0,
        error: errMsg,
      };
    }
  }

  /**
   * Get authenticated cookies header string for a given supplier domain
   */
  public static async getCookieHeaderForDomain(organizationId: string, urlOrDomain: string): Promise<string | null> {
    const domain = urlOrDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');

    const [cred] = await db
      .select()
      .from(customerSupplierCredentials)
      .where(
        and(
          eq(customerSupplierCredentials.organizationId, organizationId),
          eq(customerSupplierCredentials.supplierDomain, domain),
          eq(customerSupplierCredentials.lastStatus, 'ACTIVE')
        )
      )
      .limit(1);

    if (!cred || !Array.isArray(cred.sessionCookies) || cred.sessionCookies.length === 0) {
      return null;
    }

    const cookies = cred.sessionCookies as SupplierSessionCookie[];
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
}

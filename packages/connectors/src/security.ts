import crypto from 'crypto';

export class CredentialSecurity {
  private static readonly ALGORITHM = 'aes-256-gcm';
  // 32-byte secret key from environment or fallback dev key
  private static readonly MASTER_KEY = Buffer.from(
    (process.env.CONNECTOR_ENCRYPTION_KEY || '01234567890123456789012345678901').padEnd(32, '0').slice(0, 32)
  );

  /**
   * Encrypts sensitive store credentials using AES-256-GCM
   */
  public static encrypt(data: Record<string, any>): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.MASTER_KEY, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts AES-256-GCM credential payload
   */
  public static decrypt(cipherText: string): Record<string, any> {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted credential format');
    }
    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.MASTER_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  /**
   * SSRF Protection: Validates store URLs to prevent access to private IP ranges
   */
  public static validateStoreUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      const host = parsed.hostname.toLowerCase();
      // Block loopback and metadata addresses
      if (['localhost', '127.0.0.1', '::1', '169.254.169.254'].includes(host)) return false;
      // Block RFC 1918 private IPv4 addresses (unless in explicit test mode)
      if (process.env.NODE_ENV === 'production') {
        if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Webhook HMAC-SHA256 signature verification
   */
  public static verifyHmacSha256(payload: string, secret: string, signature: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const computedBase64 = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    return computed === signature || computedBase64 === signature;
  }
}


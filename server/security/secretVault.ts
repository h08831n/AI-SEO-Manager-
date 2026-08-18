import crypto from 'crypto';

export interface EncryptedSecretPayload {
  encryptedValue: string;
  iv: string;
  authTag: string;
  keyId: string;
}

export class SecretVault {
  /**
   * Retrieves and validates the 32-byte master encryption key from the environment.
   * Never falls back to a hardcoded key.
   */
  private static getMasterKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!rawKey || rawKey.trim().length === 0) {
      throw new Error(
        'ENCRYPTION_MASTER_KEY environment variable is required for credential encryption/decryption operations.'
      );
    }

    const trimmed = rawKey.trim();
    // Support 64-character hex string (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }

    // Support 32-byte raw utf-8 string
    if (Buffer.byteLength(trimmed, 'utf8') === 32) {
      return Buffer.from(trimmed, 'utf8');
    }

    // Otherwise hash with SHA-256 to derive a deterministic 32-byte key
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  /**
   * Validates if the encryption key is configured without exposing its value.
   */
  public static isKeyConfigured(): boolean {
    const key = process.env.ENCRYPTION_MASTER_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Encrypts a plaintext secret using AES-256-GCM
   */
  public static encrypt(plainText: string): EncryptedSecretPayload {
    const iv = crypto.randomBytes(16);
    const key = this.getMasterKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedValue: encrypted,
      iv: iv.toString('hex'),
      authTag,
      keyId: 'v1-master',
    };
  }

  /**
   * Decrypts an AES-256-GCM encrypted secret payload
   */
  public static decrypt(payload: EncryptedSecretPayload): string {
    const key = this.getMasterKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

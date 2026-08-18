import crypto from 'crypto';

export interface EncryptedSecretPayload {
  encryptedValue: string;
  iv: string;
  authTag: string;
  keyId: string;
}

export class SecretVault {
  private static getMasterKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_MASTER_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    // Ensure 32 bytes for AES-256
    return crypto.createHash('sha256').update(rawKey).digest();
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

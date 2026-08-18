import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretVault } from '../server/security/secretVault';

describe('SecretVault Portable Encryption', () => {
  const originalEnvKey = process.env.ENCRYPTION_MASTER_KEY;

  beforeEach(() => {
    // Set a test 32-byte hex key (64 hex characters)
    process.env.ENCRYPTION_MASTER_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  });

  afterEach(() => {
    process.env.ENCRYPTION_MASTER_KEY = originalEnvKey;
  });

  it('correctly reports key configured status', () => {
    expect(SecretVault.isKeyConfigured()).toBe(true);
  });

  it('encrypts and decrypts secrets with AES-256-GCM payload', () => {
    const rawSecret = 'sensitive_wp_application_password_12345';
    const encrypted = SecretVault.encrypt(rawSecret);

    expect(encrypted.encryptedValue).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.keyId).toBe('v1-master');

    const decrypted = SecretVault.decrypt(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it('fails safely when ENCRYPTION_MASTER_KEY is missing', () => {
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(SecretVault.isKeyConfigured()).toBe(false);
    expect(() => SecretVault.encrypt('secret')).toThrow(/ENCRYPTION_MASTER_KEY/);
  });
});

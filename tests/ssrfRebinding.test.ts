import { describe, it, expect, afterEach } from 'vitest';
import { SafeDestinationPolicy, SafeUrlPolicy } from '../server/security/safeUrlPolicy';

describe('SSRF Protection & DNS Rebinding (TOCTOU) Guard', () => {
  afterEach(() => {
    SafeDestinationPolicy.setCustomResolver(null);
  });

  it('blocks private IPv4 address ranges directly and by DNS resolution', async () => {
    expect(SafeDestinationPolicy.isIpBlocked('127.0.0.1')).toBe(true);
    expect(SafeDestinationPolicy.isIpBlocked('10.0.4.15')).toBe(true);
    expect(SafeDestinationPolicy.isIpBlocked('192.168.1.1')).toBe(true);
    expect(SafeDestinationPolicy.isIpBlocked('172.16.5.20')).toBe(true);
    expect(SafeDestinationPolicy.isIpBlocked('169.254.169.254')).toBe(true); // AWS / GCP metadata
  });

  it('blocks private IPv6 address ranges (loopback, ULA, link-local)', async () => {
    expect(SafeDestinationPolicy.isIpBlocked('::1')).toBe(true);
    expect(SafeDestinationPolicy.isIpBlocked('fc00::1')).toBe(true);
    expect(SafeDestinationPolicy.isIpBlocked('fd12:3456::1')).toBe(true);
    expect(SafeDestinationPolicy.isIpBlocked('fe80::1')).toBe(true);
  });

  it('allows safe public IP addresses', async () => {
    expect(SafeDestinationPolicy.isIpBlocked('93.184.216.34')).toBe(false); // example.com
    expect(SafeDestinationPolicy.isIpBlocked('142.250.190.46')).toBe(false); // google.com
  });

  it('blocks domain resolving to private IP via custom resolver', async () => {
    SafeDestinationPolicy.setCustomResolver(async (_hostname) => ['192.168.1.50']);

    const check = await SafeDestinationPolicy.resolveAndValidate('malicious-internal-rebinder.com');
    expect(check.valid).toBe(false);
    expect(check.error).toContain('restricted IP "192.168.1.50"');
  });

  it('prevents TOCTOU DNS rebinding by pinning validated IP', async () => {
    // Resolver initially returns a public IP
    let lookupCount = 0;
    SafeDestinationPolicy.setCustomResolver(async () => {
      lookupCount++;
      if (lookupCount === 1) {
        return ['93.184.216.34']; // Public IP during initial validation
      }
      return ['127.0.0.1']; // Malicious rebind attempt on second lookup
    });

    const validation = await SafeUrlPolicy.validateUrl('https://example-rebinder.com/page');
    expect(validation.valid).toBe(true);
    expect(validation.resolvedIp).toBe('93.184.216.34');
  });
});

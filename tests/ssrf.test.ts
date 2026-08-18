import { describe, it, expect } from 'vitest';
import { SafeUrlPolicy } from '../server/security/safeUrlPolicy';

describe('SafeUrlPolicy SSRF Protection', () => {
  it('blocks loopback IPv4 addresses', () => {
    expect(SafeUrlPolicy.isIpBlocked('127.0.0.1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('127.0.0.254')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('0.0.0.0')).toBe(true);
  });

  it('blocks private IPv4 RFC1918 ranges', () => {
    // 10.0.0.0/8
    expect(SafeUrlPolicy.isIpBlocked('10.0.0.1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('10.255.255.255')).toBe(true);

    // 172.16.0.0/12
    expect(SafeUrlPolicy.isIpBlocked('172.16.0.1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('172.24.1.1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('172.31.255.254')).toBe(true);

    // 192.168.0.0/16
    expect(SafeUrlPolicy.isIpBlocked('192.168.1.1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('192.168.100.50')).toBe(true);
  });

  it('blocks AWS/GCP cloud metadata IP (169.254.169.254)', () => {
    expect(SafeUrlPolicy.isIpBlocked('169.254.169.254')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('169.254.1.1')).toBe(true);
  });

  it('blocks IPv6 loopback, link-local, and unique local addresses', () => {
    expect(SafeUrlPolicy.isIpBlocked('::1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('0:0:0:0:0:0:0:1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('fe80::1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('fc00::1')).toBe(true);
    expect(SafeUrlPolicy.isIpBlocked('fd12:3456:789a::1')).toBe(true);
  });

  it('allows public IPv4 addresses', () => {
    expect(SafeUrlPolicy.isIpBlocked('8.8.8.8')).toBe(false);
    expect(SafeUrlPolicy.isIpBlocked('1.1.1.1')).toBe(false);
    expect(SafeUrlPolicy.isIpBlocked('93.184.216.34')).toBe(false); // example.com
  });

  it('validates protocol restrictions strictly to http and https', async () => {
    const fileRes = await SafeUrlPolicy.validateUrl('file:///etc/passwd');
    expect(fileRes.valid).toBe(false);
    expect(fileRes.error).toContain('Disallowed protocol');

    const gopherRes = await SafeUrlPolicy.validateUrl('gopher://127.0.0.1:70');
    expect(gopherRes.valid).toBe(false);

    const ftpRes = await SafeUrlPolicy.validateUrl('ftp://example.com/file.txt');
    expect(ftpRes.valid).toBe(false);
  });

  it('blocks internal hostnames and metadata endpoints', async () => {
    const localRes = await SafeUrlPolicy.validateUrl('http://localhost:3000');
    expect(localRes.valid).toBe(false);

    const metaRes = await SafeUrlPolicy.validateUrl('http://metadata.google.internal/computeMetadata/v1');
    expect(metaRes.valid).toBe(false);

    const localSuffixRes = await SafeUrlPolicy.validateUrl('http://app.local/api');
    expect(localSuffixRes.valid).toBe(false);
  });
});

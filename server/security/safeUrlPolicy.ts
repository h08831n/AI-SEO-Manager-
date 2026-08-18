import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const lookupAsync = promisify(dns.lookup);

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
  allowedContentTypes?: string[];
  userAgent?: string;
}

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  redirectCount: number;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  loadTimeMs: number;
}

export class SafeUrlPolicy {
  /**
   * Validates whether an IP address is in a private, loopback, link-local, or cloud metadata range.
   */
  public static isIpBlocked(ip: string): boolean {
    // Check for IPv4 mapped IPv6 (e.g. ::ffff:127.0.0.1)
    if (ip.startsWith('::ffff:')) {
      const ipv4 = ip.substring(7);
      return this.isIpBlocked(ipv4);
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      // Loopback
      if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
      // Unspecified
      if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
      // Link-local (fe80::/10)
      if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
      // Unique Local Address ULA (fc00::/7)
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
      return false;
    }

    // IPv4 checks
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map((p) => parseInt(p, 10));
      if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;

      const [b0, b1, b2, b3] = parts;

      // 0.0.0.0/8 (Current network)
      if (b0 === 0) return true;
      // 127.0.0.0/8 (Loopback)
      if (b0 === 127) return true;
      // 10.0.0.0/8 (Private RFC1918)
      if (b0 === 10) return true;
      // 172.16.0.0/12 (Private RFC1918: 172.16.0.0 - 172.31.255.255)
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      // 192.168.0.0/16 (Private RFC1918)
      if (b0 === 192 && b1 === 168) return true;
      // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
      if (b0 === 169 && b1 === 254) return true;
      // 100.64.0.0/10 (Carrier-grade NAT)
      if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
      // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
      if ((b0 === 192 && b1 === 0 && b2 === 2) || (b0 === 198 && b1 === 51 && b2 === 100) || (b0 === 203 && b1 === 0 && b2 === 113)) return true;
      // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
      if (b0 >= 224) return true;

      return false;
    }

    return true; // If not a valid IPv4 or IPv6, block
  }

  /**
   * Validates a target URL against protocol and DNS SSRF restrictions.
   */
  public static async validateUrl(targetUrl: string): Promise<{ valid: boolean; error?: string; resolvedIp?: string; parsedUrl?: URL }> {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Disallowed protocol: ${parsed.protocol}. Only http: and https: are permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      return { valid: false, error: `Access to internal hostname "${hostname}" is blocked for security.` };
    }

    // If hostname is directly an IP
    if (net.isIP(hostname)) {
      if (this.isIpBlocked(hostname)) {
        return { valid: false, error: `IP address "${hostname}" is in a private, loopback or restricted range.` };
      }
      return { valid: true, resolvedIp: hostname, parsedUrl: parsed };
    }

    // Resolve DNS lookup
    try {
      const lookupResult = await lookupAsync(hostname, { all: true });
      for (const record of lookupResult) {
        if (this.isIpBlocked(record.address)) {
          return {
            valid: false,
            error: `Domain "${hostname}" resolved to restricted IP address "${record.address}". Access blocked.`,
          };
        }
      }
      return { valid: true, resolvedIp: lookupResult[0]?.address, parsedUrl: parsed };
    } catch (err: any) {
      return { valid: false, error: `DNS resolution failed for "${hostname}": ${err.message}` };
    }
  }

  /**
   * Performs an SSRF-safe HTTP request with redirect validation, timeout, and response bounds.
   */
  public static async safeFetch(
    initialUrl: string,
    options: SafeFetchOptions = {}
  ): Promise<SafeFetchResult> {
    const {
      timeoutMs = 8000,
      maxRedirects = 5,
      maxResponseBytes = 5 * 1024 * 1024, // 5MB limit
      allowedContentTypes = ['text/html', 'application/xhtml+xml', 'text/plain'],
      userAgent = 'Mozilla/5.0 (compatible; AI-SEO-Manager/2.0; +https://techscale.io/bot)',
    } = options;

    let currentUrl = initialUrl;
    let redirectCount = 0;
    const startTime = Date.now();

    while (redirectCount <= maxRedirects) {
      // 1. Validate destination URL before every single request
      const validation = await this.validateUrl(currentUrl);
      if (!validation.valid) {
        throw new Error(`SSRF Guard blocked request to ${currentUrl}: ${validation.error}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          signal: controller.signal,
          redirect: 'manual', // Never let fetch follow redirects automatically; inspect each hop!
        });

        clearTimeout(timeoutId);

        // Check for redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            throw new Error(`Redirect status ${response.status} returned without Location header`);
          }

          // Resolve relative redirect against current URL
          const nextUrl = new URL(location, currentUrl).toString();
          redirectCount++;

          if (redirectCount > maxRedirects) {
            throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
          }

          currentUrl = nextUrl;
          continue; // Loop to next hop with safe validation
        }

        // Validate content type
        const contentType = response.headers.get('content-type') || '';
        const isAllowedType = allowedContentTypes.some((t) => contentType.toLowerCase().includes(t));
        if (!isAllowedType && response.status === 200) {
          throw new Error(`Disallowed content-type "${contentType}". Only web document types are parsed.`);
        }

        // Read response body with byte limit
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.length;
              if (totalBytes > maxResponseBytes) {
                controller.abort();
                throw new Error(`Response exceeded maximum allowed size of ${maxResponseBytes} bytes`);
              }
              chunks.push(value);
            }
          }
        }

        const totalBuffer = Buffer.concat(chunks);
        const bodyText = totalBuffer.toString('utf-8');

        const headersMap: Record<string, string> = {};
        response.headers.forEach((val, key) => {
          headersMap[key.toLowerCase()] = val;
        });

        const loadTimeMs = Date.now() - startTime;

        return {
          requestedUrl: initialUrl,
          finalUrl: currentUrl,
          redirectCount,
          statusCode: response.status,
          headers: headersMap,
          body: bodyText,
          contentType,
          loadTimeMs,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error(`Request timed out after ${timeoutMs}ms`);
        }
        throw err;
      }
    }

    throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
  }
}

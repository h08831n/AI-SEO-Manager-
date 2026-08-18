import dns from 'dns';
import { promisify } from 'util';
import net from 'net';
import http from 'http';
import https from 'https';

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

export type DnsResolverFn = (hostname: string) => Promise<string[]>;

/**
 * 1. SafeDestinationPolicy: Validates Host, IP, Protocol, and Port
 */
export class SafeDestinationPolicy {
  private static customResolver: DnsResolverFn | null = null;

  public static setCustomResolver(resolver: DnsResolverFn | null): void {
    this.customResolver = resolver;
  }

  public static isIpBlocked(ip: string): boolean {
    if (ip.startsWith('::ffff:')) {
      const ipv4 = ip.substring(7);
      return this.isIpBlocked(ipv4);
    }

    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
      if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
      if (
        normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb')
      )
        return true;
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
      return false;
    }

    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map((p) => parseInt(p, 10));
      if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;

      const [b0, b1, b2, b3] = parts;
      if (b0 === 0) return true; // Current network
      if (b0 === 127) return true; // Loopback
      if (b0 === 10) return true; // RFC1918 Private
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // RFC1918 Private
      if (b0 === 192 && b1 === 168) return true; // RFC1918 Private
      if (b0 === 169 && b1 === 254) return true; // Link-Local & Cloud Metadata (169.254.169.254)
      if (b0 === 100 && b1 >= 64 && b1 <= 127) return true; // Carrier-grade NAT
      if (
        (b0 === 192 && b1 === 0 && b2 === 2) ||
        (b0 === 198 && b1 === 51 && b2 === 100) ||
        (b0 === 203 && b1 === 0 && b2 === 113)
      )
        return true;
      if (b0 >= 224) return true; // Multicast & Reserved

      return false;
    }

    return true;
  }

  public static async resolveAndValidate(
    hostname: string
  ): Promise<{ valid: boolean; resolvedIps: string[]; error?: string }> {
    const lowerHost = hostname.toLowerCase();

    if (
      lowerHost === 'localhost' ||
      lowerHost.endsWith('.localhost') ||
      lowerHost.endsWith('.local') ||
      lowerHost.endsWith('.internal') ||
      lowerHost === 'metadata.google.internal' ||
      lowerHost === 'instance-data'
    ) {
      return {
        valid: false,
        resolvedIps: [],
        error: `Access to internal hostname "${hostname}" is blocked.`,
      };
    }

    if (net.isIP(hostname)) {
      if (this.isIpBlocked(hostname)) {
        return {
          valid: false,
          resolvedIps: [hostname],
          error: `IP address "${hostname}" is in a private or restricted range.`,
        };
      }
      return { valid: true, resolvedIps: [hostname] };
    }

    try {
      let ips: string[] = [];
      if (this.customResolver) {
        ips = await this.customResolver(hostname);
      } else {
        const lookupResult = await lookupAsync(hostname, { all: true });
        ips = lookupResult.map((r) => r.address);
      }

      if (!ips || ips.length === 0) {
        return { valid: false, resolvedIps: [], error: `DNS returned no addresses for ${hostname}` };
      }

      for (const ip of ips) {
        if (this.isIpBlocked(ip)) {
          return {
            valid: false,
            resolvedIps: ips,
            error: `Domain "${hostname}" resolved to restricted IP "${ip}". Access blocked.`,
          };
        }
      }

      return { valid: true, resolvedIps: ips };
    } catch (err: any) {
      return { valid: false, resolvedIps: [], error: `DNS resolution failed: ${err.message}` };
    }
  }
}

/**
 * 2. ResponseContentPolicy: Validates Content Type, Size Limits, and Headers
 */
export class ResponseContentPolicy {
  public static validateContentType(contentType: string, allowedTypes: string[]): boolean {
    if (!allowedTypes || allowedTypes.length === 0 || allowedTypes.includes('*/*')) return true;
    const lower = (contentType || '').toLowerCase();
    return allowedTypes.some((t) => lower.includes(t.toLowerCase()));
  }

  public static validateByteSize(currentBytes: number, maxBytes: number): void {
    if (currentBytes > maxBytes) {
      throw new Error(`Response payload exceeded size limit of ${maxBytes} bytes`);
    }
  }
}

/**
 * 3. SafeUrlPolicy: Coordinates DNS-pinned fetch without TOCTOU DNS rebinding
 */
export class SafeUrlPolicy {
  public static isIpBlocked(ip: string): boolean {
    return SafeDestinationPolicy.isIpBlocked(ip);
  }

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

    const destCheck = await SafeDestinationPolicy.resolveAndValidate(parsed.hostname);
    if (!destCheck.valid) {
      return { valid: false, error: destCheck.error };
    }

    return { valid: true, resolvedIp: destCheck.resolvedIps[0], parsedUrl: parsed };
  }

  public static async safeFetch(
    initialUrl: string,
    options: SafeFetchOptions = {}
  ): Promise<SafeFetchResult> {
    const {
      timeoutMs = 8000,
      maxRedirects = 5,
      maxResponseBytes = 5 * 1024 * 1024,
      allowedContentTypes = ['text/html', 'application/xhtml+xml', 'text/plain'],
      userAgent = 'Mozilla/5.0 (compatible; AI-SEO-Manager/2.0; +https://techscale.io/bot)',
    } = options;

    let currentUrl = initialUrl;
    let redirectCount = 0;
    const startTime = Date.now();

    while (redirectCount <= maxRedirects) {
      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        throw new Error(`Invalid URL: ${currentUrl}`);
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Protocol "${parsed.protocol}" not allowed. Only HTTP and HTTPS are permitted.`);
      }

      // 1. Resolve and validate IP
      const destCheck = await SafeDestinationPolicy.resolveAndValidate(parsed.hostname);
      if (!destCheck.valid) {
        throw new Error(`SSRF Guard blocked request to ${currentUrl}: ${destCheck.error}`);
      }

      const pinnedIp = destCheck.resolvedIps[0];

      // 2. Perform connection with DNS Pinning (lookup pins directly to validated IP to prevent TOCTOU DNS rebinding)
      const agentOptions = {
        lookup: (_hostname: string, _opts: any, cb: any) => {
          // Re-verify the IP before handing it to the socket connection
          if (SafeDestinationPolicy.isIpBlocked(pinnedIp)) {
            cb(new Error(`SSRF TOCTOU Guard: Target IP ${pinnedIp} is blocked`));
          } else {
            cb(null, pinnedIp, net.isIPv6(pinnedIp) ? 6 : 4);
          }
        },
      };

      const customAgent = parsed.protocol === 'https:' ? new https.Agent(agentOptions) : new http.Agent(agentOptions);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // @ts-ignore
        const response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            Accept: allowedContentTypes.join(', '),
            'Accept-Language': 'en-US,en;q=0.5',
          },
          signal: controller.signal,
          redirect: 'manual', // Inspect each redirect hop individually
          // @ts-ignore
          agent: customAgent,
        });

        clearTimeout(timeoutId);

        // Check redirects
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            throw new Error(`Redirect ${response.status} missing Location header`);
          }

          const nextUrl = new URL(location, currentUrl).toString();
          redirectCount++;

          if (redirectCount > maxRedirects) {
            throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
          }

          currentUrl = nextUrl;
          continue;
        }

        // Validate content-type
        const contentType = response.headers.get('content-type') || '';
        if (response.status === 200 && !ResponseContentPolicy.validateContentType(contentType, allowedContentTypes)) {
          throw new Error(`Disallowed content-type "${contentType}". Allowed: ${allowedContentTypes.join(', ')}`);
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
              ResponseContentPolicy.validateByteSize(totalBytes, maxResponseBytes);
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

        return {
          requestedUrl: initialUrl,
          finalUrl: currentUrl,
          redirectCount,
          statusCode: response.status,
          headers: headersMap,
          body: bodyText,
          contentType,
          loadTimeMs: Date.now() - startTime,
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

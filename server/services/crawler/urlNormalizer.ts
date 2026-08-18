export interface UrlNormalizerOptions {
  stripTrailingSlash?: boolean;
  stripTrackingParams?: boolean;
  sortQueryParams?: boolean;
  stripFragments?: boolean;
  stripDefaultPort?: boolean;
  customIgnoredParams?: string[];
}

const DEFAULT_TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'yclid',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
]);

export class UrlNormalizer {
  /**
   * Fully normalizes a raw URL according to strict RFC 3986 rules and SEO normalization standards.
   */
  public static normalize(rawUrl: string, baseOrigin?: string, options: UrlNormalizerOptions = {}): string {
    const {
      stripTrailingSlash = true,
      stripTrackingParams = true,
      sortQueryParams = true,
      stripFragments = true,
      stripDefaultPort = true,
      customIgnoredParams = [],
    } = options;

    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('Invalid URL input: empty or non-string');
    }

    let parsed: URL;
    try {
      parsed = baseOrigin ? new URL(rawUrl.trim(), baseOrigin) : new URL(rawUrl.trim());
    } catch {
      throw new Error(`Cannot parse URL: ${rawUrl}`);
    }

    // 1. Protocol normalization (lowercase)
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }

    // 2. Hostname normalization (lowercase, IDN punycode handled automatically by WHATWG URL)
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.endsWith('.')) {
      hostname = hostname.slice(0, -1);
    }

    // 3. Port normalization (strip default ports 80 for HTTP, 443 for HTTPS)
    let port = parsed.port;
    if (stripDefaultPort) {
      if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) {
        port = '';
      }
    }
    const hostWithPort = port ? `${hostname}:${port}` : hostname;

    // 4. Pathname normalization
    let pathname = parsed.pathname || '/';
    // Collapse duplicate slashes
    pathname = pathname.replace(/\/+/g, '/');
    // Trailing slash policy (preserve root '/', remove for subpaths if configured)
    if (stripTrailingSlash && pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // 5. Query parameters handling
    const searchParams = new URLSearchParams(parsed.search);
    const ignoredSet = new Set([...(stripTrackingParams ? DEFAULT_TRACKING_PARAMS : []), ...customIgnoredParams]);

    const filteredParams: Array<[string, string]> = [];
    searchParams.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (!ignoredSet.has(lowerKey)) {
        filteredParams.push([key, val]);
      }
    });

    if (sortQueryParams) {
      filteredParams.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    }

    let searchString = '';
    if (filteredParams.length > 0) {
      const sp = new URLSearchParams();
      filteredParams.forEach(([k, v]) => sp.append(k, v));
      searchString = `?${sp.toString()}`;
    }

    // 6. Fragment handling
    const hash = stripFragments ? '' : parsed.hash;

    return `${protocol}//${hostWithPort}${pathname}${searchString}${hash}`;
  }

  /**
   * Resolves a relative or absolute URL against a base URL and normalizes it.
   */
  public static resolveAndNormalize(relativeOrAbsolute: string, baseUrl: string, options?: UrlNormalizerOptions): string {
    const resolved = new URL(relativeOrAbsolute, baseUrl).toString();
    return this.normalize(resolved, undefined, options);
  }
}

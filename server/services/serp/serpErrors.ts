export class SerpProviderTimeoutError extends Error {
  constructor(message = 'SERP Provider request timed out') {
    super(message);
    this.name = 'SerpProviderTimeoutError';
  }
}

export class SerpRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message = 'SERP Provider rate limit exceeded (429)', retryAfterMs = 5000) {
    super(message);
    this.name = 'SerpRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class SerpProviderError extends Error {
  readonly provider: string;
  readonly statusCode?: number;

  constructor(message: string, provider: string, statusCode?: number) {
    super(message);
    this.name = 'SerpProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleOAuthClient } from '../server/services/integrations/providers/googleOAuthClient';

describe('Phase 3: GoogleOAuthClient Test Suite', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-key';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/integrations/google/callback';
  });

  it('generates cryptographically secure state strings', () => {
    const state1 = GoogleOAuthClient.generateState();
    const state2 = GoogleOAuthClient.generateState();
    expect(state1).toBeDefined();
    expect(state2).toBeDefined();
    expect(state1.length).toBe(64); // 32 hex bytes
    expect(state1).not.toEqual(state2);
  });

  it('generates valid PKCE code verifier and SHA256 code challenge', () => {
    const { codeVerifier, codeChallenge } = GoogleOAuthClient.generatePkce();
    expect(codeVerifier).toBeDefined();
    expect(codeChallenge).toBeDefined();
    expect(codeVerifier.length).toBeGreaterThan(30);
    expect(codeChallenge.length).toBeGreaterThan(30);
    expect(codeVerifier).not.toEqual(codeChallenge);
  });

  it('constructs well-formed authorization URLs with all required parameters', () => {
    const state = GoogleOAuthClient.generateState();
    const { codeChallenge } = GoogleOAuthClient.generatePkce();

    const authUrl = GoogleOAuthClient.generateAuthUrl({
      state,
      codeChallenge,
    });

    const parsed = new URL(authUrl);
    expect(parsed.hostname).toBe('accounts.google.com');
    expect(parsed.pathname).toBe('/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('state')).toBe(state);
    expect(parsed.searchParams.get('code_challenge')).toBe(codeChallenge);
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');

    const scopes = parsed.searchParams.get('scope') || '';
    expect(scopes).toContain('webmasters.readonly');
    expect(scopes).toContain('analytics.readonly');
  });

  it('handles token exchange response parsing', async () => {
    const mockResponse = {
      access_token: 'mock-access-token-12345',
      refresh_token: 'mock-refresh-token-67890',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const tokens = await GoogleOAuthClient.exchangeCodeForTokens({
      code: 'auth-code-test',
      codeVerifier: 'verifier-123',
    });

    expect(tokens.accessToken).toBe('mock-access-token-12345');
    expect(tokens.refreshToken).toBe('mock-refresh-token-67890');
    expect(tokens.expiresIn).toBe(3600);
  });

  it('propagates token refresh errors gracefully when token is revoked', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant","error_description":"Token has been expired or revoked."}',
    } as any);

    await expect(GoogleOAuthClient.refreshAccessToken('invalid-refresh-token')).rejects.toThrow(
      'TOKEN_REVOKED_OR_INVALID'
    );
  });
});

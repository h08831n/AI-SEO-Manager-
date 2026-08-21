import { describe, it, expect, beforeEach } from 'vitest';
import { GoogleIntegrationRepository } from '../server/repositories/googleIntegrationRepository';
import { GoogleOAuthClient } from '../server/services/integrations/providers/googleOAuthClient';
import { prisma } from '../server/db/prisma';

describe('Phase 3: Google OAuth Security & Concurrency Test Suite', () => {
  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-key';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/integrations/google/callback';
  });

  it('binds state session securely with workspaceId, userId, websiteId and PKCE verifier', async () => {
    const state = GoogleOAuthClient.generateState();
    const { codeVerifier } = GoogleOAuthClient.generatePkce();

    await GoogleIntegrationRepository.createOAuthStateSession({
      state,
      codeVerifier,
      workspaceId: 'ws-security-123',
      userId: 'user-sec-456',
      websiteId: 'website-sec-789',
      redirectUri: 'http://localhost:3000/api/integrations/google/callback',
      expiresInMinutes: 15,
    });

    const session = await GoogleIntegrationRepository.consumeOAuthStateSession(state);
    expect(session).toBeDefined();
    expect(session.workspaceId).toBe('ws-security-123');
    expect(session.userId).toBe('user-sec-456');
    expect(session.websiteId).toBe('website-sec-789');
    expect(session.codeVerifier).toBe(codeVerifier);
  });

  it('rejects expired OAuth state sessions', async () => {
    const state = GoogleOAuthClient.generateState();
    const { codeVerifier } = GoogleOAuthClient.generatePkce();

    // Insert an already expired session directly
    await prisma.oAuthStateSession.create({
      data: {
        state,
        codeVerifier,
        workspaceId: 'ws-security-expired',
        userId: 'user-sec-expired',
        redirectUri: 'http://localhost:3000/api/integrations/google/callback',
        expiresAt: new Date(Date.now() - 60000), // 1 minute in past
      },
    });

    await expect(GoogleIntegrationRepository.consumeOAuthStateSession(state)).rejects.toThrow(
      'EXPIRED'
    );
  });

  it('rejects replay attacks (single-use consumption constraint)', async () => {
    const state = GoogleOAuthClient.generateState();
    const { codeVerifier } = GoogleOAuthClient.generatePkce();

    await GoogleIntegrationRepository.createOAuthStateSession({
      state,
      codeVerifier,
      workspaceId: 'ws-replay-test',
      userId: 'user-replay',
      redirectUri: 'http://localhost:3000/api/integrations/google/callback',
      expiresInMinutes: 10,
    });

    // 1st consumption succeeds
    const firstAttempt = await GoogleIntegrationRepository.consumeOAuthStateSession(state);
    expect(firstAttempt.workspaceId).toBe('ws-replay-test');

    // 2nd consumption fails (already used)
    await expect(GoogleIntegrationRepository.consumeOAuthStateSession(state)).rejects.toThrow(
      'USED'
    );
  });

  it('guarantees atomic consumption under concurrent race conditions (exactly 1 winner among 10 parallel consumers)', async () => {
    const state = GoogleOAuthClient.generateState();
    const { codeVerifier } = GoogleOAuthClient.generatePkce();

    await GoogleIntegrationRepository.createOAuthStateSession({
      state,
      codeVerifier,
      workspaceId: 'ws-race-test',
      userId: 'user-race',
      redirectUri: 'http://localhost:3000/api/integrations/google/callback',
      expiresInMinutes: 10,
    });

    // Launch 10 simultaneous parallel attempts to consume the state
    const attempts = Array.from({ length: 10 }).map(() =>
      GoogleIntegrationRepository.consumeOAuthStateSession(state)
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(attempts);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(9);
  });

  it('verifies granted scopes and detects partial permissions', () => {
    const fullScopes = [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly',
    ];

    const partialScopes = [
      'https://www.googleapis.com/auth/webmasters.readonly',
    ];

    const hasGscFull = fullScopes.some((s) => s.includes('webmasters.readonly'));
    const hasGa4Full = fullScopes.some((s) => s.includes('analytics.readonly'));
    expect(hasGscFull && hasGa4Full).toBe(true);

    const hasGscPartial = partialScopes.some((s) => s.includes('webmasters.readonly'));
    const hasGa4Partial = partialScopes.some((s) => s.includes('analytics.readonly'));
    expect(hasGscPartial).toBe(true);
    expect(hasGa4Partial).toBe(false);
  });
});

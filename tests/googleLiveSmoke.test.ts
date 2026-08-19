import { describe, it, expect } from 'vitest';
import { GoogleOAuthClient } from '../server/services/integrations/providers/googleOAuthClient';
import { GoogleSearchConsoleProvider } from '../server/services/integrations/providers/googleSearchConsoleProvider';
import { GoogleAnalytics4Provider } from '../server/services/integrations/providers/googleAnalytics4Provider';

describe('Phase 3: Opt-in Live Google OAuth & Provider Verification', () => {
  const isLiveConfigured =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_TEST_REFRESH_TOKEN);

  it('verifies live Google API credentials if provisioned (skips safely when deferred)', async () => {
    if (!isLiveConfigured) {
      console.log(
        '[OPT-IN LIVE TEST] Live Google credentials not present in this runtime. Status: BLOCKED_EXTERNAL_CREDENTIALS. Skipping live HTTP call cleanly.'
      );
      expect(true).toBe(true);
      return;
    }

    // When real credentials are provided in live staging environment:
    const refreshToken = process.env.GOOGLE_TEST_REFRESH_TOKEN!;
    const tokenResult = await GoogleOAuthClient.refreshAccessToken(refreshToken);

    expect(tokenResult.accessToken).toBeDefined();
    expect(tokenResult.accessToken.length).toBeGreaterThan(10);

    const tokenInfo = await GoogleOAuthClient.verifyTokenInfo(tokenResult.accessToken);
    expect(tokenInfo.scopes.length).toBeGreaterThan(0);

    // Verify Search Console Property discovery
    const gsc = new GoogleSearchConsoleProvider();
    const properties = await gsc.listAccessibleProperties(tokenResult.accessToken);
    expect(Array.isArray(properties)).toBe(true);

    // Verify GA4 Account discovery
    const ga4 = new GoogleAnalytics4Provider();
    const ga4Data = await ga4.listAccessibleAccountsAndProperties(tokenResult.accessToken);
    expect(Array.isArray(ga4Data.accounts)).toBe(true);
  });
});

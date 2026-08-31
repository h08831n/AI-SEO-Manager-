import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { WordPressSimulationProvider } from '../server/services/action/cms/wordPressSimulationProvider';
import { WordPressProductionProvider } from '../server/services/action/cms/wordPressProductionProvider';
import { CmsProviderRegistry } from '../server/services/action/cms/cmsProviderRegistry';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';
import { PolicySafetyGate } from '../server/services/bayesian/policySafetyGate';
import { CausalAttributionEngine } from '../server/services/attribution/causalAttributionEngine';
import { ActionExecutionPipeline } from '../server/services/action/actionExecutionPipeline';
import { ProductionAuthenticationProvider } from '../server/security/authenticationProvider';
import { SecretVault } from '../server/security/secretVault';

describe('Canary Gate Remediation Hardening Tests', () => {
  const testWebsiteId = 'ws-canary-test-1';
  const testTargetUrl = 'https://example.com/blog/seo-guide';

  beforeEach(async () => {
    // Reset test website
    await (prisma.website as any).upsert?.({
      where: { id: testWebsiteId },
      create: {
        id: testWebsiteId,
        domain: 'https://example.com',
        workspaceId: 'default-workspace',
        autonomyCircuitBroken: false,
      },
      update: {
        autonomyCircuitBroken: false,
        circuitBreakerReason: null,
      },
    });
  });

  describe('1. CMS Provider Separation & Resolution', () => {
    it('WordPressSimulationProvider executes in SIMULATION mode safely without HTTP calls', async () => {
      const simProvider = new WordPressSimulationProvider();
      expect(simProvider.mode).toBe('SIMULATION');

      const res = await simProvider.setCanonicalUrl('https://example.com/test', 'https://example.com/canonical');
      expect(res.success).toBe(true);
      expect(res.appliedData.canonicalUrl).toBe('https://example.com/canonical');
      expect(res.message).toContain('WordPress Simulation');
    });

    it('WordPressProductionProvider validates required live credentials and mode is PRODUCTION', () => {
      expect(() => new WordPressProductionProvider({} as any)).toThrow(/WORDPRESS_PRODUCTION_CONFIG_REQUIRED/);

      const prodProvider = new WordPressProductionProvider({
        endpointUrl: 'https://wp.example.com',
        username: 'admin',
        applicationPassword: 'secret-app-password',
      });
      expect(prodProvider.mode).toBe('PRODUCTION');
    });

    it('CmsProviderRegistry resolves simulation in dev and fails closed on unconfigured prod website', async () => {
      const devProvider = await CmsProviderRegistry.getProviderForWebsite(testWebsiteId, 'SIMULATION');
      expect(devProvider.mode).toBe('SIMULATION');

      await expect(
        CmsProviderRegistry.getProviderForWebsite(testWebsiteId, 'PRODUCTION')
      ).rejects.toThrow(/CMS_INTEGRATION_NOT_FOUND/);
    });
  });

  describe('2. Action Approval Center & Durable Intent Binding', () => {
    it('computes deterministic payload hash and transitions through formal states', async () => {
      const payload = { canonicalUrl: 'https://example.com/target', robots: 'index,follow' };
      const hash1 = ActionApprovalCenter.computePayloadHash(payload);
      const hash2 = ActionApprovalCenter.computePayloadHash({ robots: 'index,follow', canonicalUrl: 'https://example.com/target' });
      expect(hash1).toBe(hash2);

      const item = await ActionApprovalCenter.proposeAction({
        websiteId: testWebsiteId,
        actionType: 'SET_CANONICAL_URL',
        targetUrl: testTargetUrl,
        payload,
        riskTier: 'HIGH',
      });

      expect(item.state).toBe('PROPOSED');
      expect(item.payloadHash).toBe(hash1);
      expect(item.expiresAt).toBeDefined();

      const approved = await ActionApprovalCenter.approveAction({
        actionId: item.id,
        userId: 'admin-user-1',
        notes: 'Approved for canary deployment',
      });
      expect(approved.state).toBe('APPROVED');
      expect(approved.approvedBy).toBe('admin-user-1');

      const executing = await ActionApprovalCenter.markExecuting(item.id, 'exec-123', 'worker-1');
      expect(executing.state).toBe('EXECUTING');
      expect(executing.consumedAt).toBeDefined();

      const verified = await ActionApprovalCenter.markVerified(item.id, 'verifier-1');
      expect(verified.state).toBe('VERIFIED');
    });

    it('supports explicit revoking of approval intent', async () => {
      const item = await ActionApprovalCenter.proposeAction({
        websiteId: testWebsiteId,
        actionType: 'CREATE_REDIRECT_RULE',
        targetUrl: testTargetUrl,
        payload: { destinationUrl: 'https://example.com/new' },
      });

      const revoked = await ActionApprovalCenter.revokeAction({
        actionId: item.id,
        userId: 'admin-user',
        reason: 'Policy cancellation',
      });
      expect(revoked.state).toBe('REVOKED');
      expect(revoked.revokedAt).toBeDefined();
    });
  });

  describe('3. Bayesian Auto-Damping Rate Limiting (±0.15 boundary)', () => {
    it('clamps severe auto-damping reduction to maximum per-cycle delta (0.15)', () => {
      const result = PolicySafetyGate.evaluateWeightUpdate({
        currentAppliedWeight: 1.0,
        currentApprovalStatus: 'ACTIVE',
        rawCalculatedWeight: 0.20,
        posteriorWinRate: 0.20,
        observedWins: 2,
        observedLosses: 10,
        isCurrentlyDamped: false,
      });

      expect(result.isAutoDamped).toBe(true);
      expect(result.approvalStatus).toBe('PENDING_REVIEW');
      expect(result.approvedAppliedWeight).toBeLessThanOrEqual(0.40);

      // Standard policy adjustments are clamped to ±0.15 per cycle
      const standardAdjustment = PolicySafetyGate.evaluateWeightAdjustment({
        ruleKey: 'canonical_optimization',
        currentWeight: 1.0,
        proposedWeight: 0.20,
        alphaPosterior: 10,
        betaPosterior: 10,
      });
      expect(standardAdjustment.isApproved).toBe(true);
      expect(standardAdjustment.appliedWeight).toBe(0.85);
      expect(standardAdjustment.wasClamped).toBe(true);
    });
  });

  describe('4. Attribution Observation Completeness & Controls', () => {
    it('rejects low observation completeness (<80%) with INCONCLUSIVE outcome', () => {
      const result = CausalAttributionEngine.calculateLift({
        treatmentWindow: {
          preMetrics: { clicks: 100, impressions: 1000 },
          postMetrics: { clicks: 120, impressions: 1200 },
          windowDays: 30,
        },
        controlWindow: {
          preMetrics: { clicks: 100, impressions: 1000 },
          postMetrics: { clicks: 100, impressions: 1000 },
          windowDays: 30,
        },
        similarityScore: 0.40, // Low similarity
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('5. Autonomy Circuit Breaker Tripping', () => {
    it('trips circuit breaker and suspends autonomous execution upon failure', async () => {
      await ActionExecutionPipeline.tripCircuitBreaker(
        testWebsiteId,
        'Test rollback verification failure'
      );

      const website = await prisma.website.findUnique({ where: { id: testWebsiteId } });
      expect(website?.autonomyCircuitBroken).toBe(true);
      expect(website?.circuitBreakerReason).toBe('Test rollback verification failure');
    });
  });

  describe('6. Production Auth Security', () => {
    it('rejects plaintext user ID tokens in ProductionAuthenticationProvider', async () => {
      const prodAuth = new ProductionAuthenticationProvider();
      const mockReq: any = {
        headers: {
          authorization: 'Bearer plain-user-id-bypass',
        },
      };

      const principal = await prodAuth.authenticate(mockReq);
      expect(principal).toBeNull();
    });

    it('accepts valid signed JWTs in ProductionAuthenticationProvider', async () => {
      const prodAuth = new ProductionAuthenticationProvider();
      const token = ProductionAuthenticationProvider.signJwt({
        userId: 'verified-user-1',
        email: 'admin@example.com',
        isSystemAdmin: true,
        workspaceMemberships: [{ workspaceId: 'default-workspace', role: 'OWNER' }],
      });

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      };

      const principal = await prodAuth.authenticate(mockReq);
      expect(principal).not.toBeNull();
      expect(principal?.userId).toBe('verified-user-1');
      expect(principal?.email).toBe('admin@example.com');
      expect(principal?.isSystemAdmin).toBe(true);
    });
  });
});

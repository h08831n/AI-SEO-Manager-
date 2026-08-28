import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../server/db/prisma';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';
import { ActionExecutionPipeline } from '../server/services/action/actionExecutionPipeline';
import { WordPressCmsProvider } from '../server/services/action/cms/wordPressCmsProvider';
import { ProductionAuthenticationProvider, DevelopmentAuthenticationProvider } from '../server/security/authenticationProvider';
import { ProductionHttpVerifier } from '../server/services/action/productionHttpVerifier';
import { VerificationEngine } from '../server/services/action/verificationEngine';
import { Request } from 'express';

describe('P0 Runtime Correction Audit Verification Suite', () => {
  const testSiteId = 'site-audit-p0-test';

  beforeEach(async () => {
    await prisma.website.upsert({
      where: { id: testSiteId },
      update: { domain: 'audit-p0-test.com' },
      create: {
        id: testSiteId,
        workspaceId: 'ws-audit-p0',
        domain: 'audit-p0-test.com',
        name: 'Audit P0 Test Site',
        productionUrl: 'https://audit-p0-test.com',
        industry: 'SaaS',
      },
    });
  });

  describe('P0-6: Action Approval State Machine Transitions', () => {
    it('allows valid PROPOSED -> APPROVED -> QUEUED -> EXECUTING transitions and rejects illegal transitions', async () => {
      const item = await ActionApprovalCenter.proposeAction({
        websiteId: testSiteId,
        actionType: 'UPDATE_ROBOTS_TXT',
        targetUrl: 'https://audit-p0-test.com/robots.txt',
        ruleKey: 'ROBOTS_RULE',
        payload: { content: 'User-agent: *\\nDisallow: /admin' },
      });

      expect(item.state).toBe('PROPOSED');

      // Approve action
      const approved = await ActionApprovalCenter.approveAction({
        actionId: item.id,
        userId: 'admin-usr',
        notes: 'Approved for deployment',
      });
      expect(approved.state).toBe('APPROVED');

      // Queue action
      const queued = await ActionApprovalCenter.queueAction(item.id, 'WORKER');
      expect(queued.state).toBe('QUEUED');

      // Mark executing
      const executing = await ActionApprovalCenter.markExecuting(item.id, 'exec-123', 'WORKER');
      expect(executing.state).toBe('EXECUTING');

      // Attempt illegal transition: cannot go directly from EXECUTING to APPROVED
      await expect(
        ActionApprovalCenter.approveAction({ actionId: item.id, userId: 'admin-usr' })
      ).rejects.toThrow(/cannot transition from/i);
    });
  });

  describe('P0-7: Approval Intent Binding & Payload Hashing', () => {
    it('computes deterministic SHA-256 hash regardless of object key order', () => {
      const payload1 = { title: 'SEO Title', meta: 'SEO Desc', tags: ['seo', 'growth'] };
      const payload2 = { tags: ['seo', 'growth'], meta: 'SEO Desc', title: 'SEO Title' };

      const hash1 = ActionApprovalCenter.computePayloadHash(payload1);
      const hash2 = ActionApprovalCenter.computePayloadHash(payload2);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it('rejects execution when execution payload differs from approved intent payload', async () => {
      const originalFlag = process.env.AUTONOMOUS_EXECUTION_ENABLED;
      process.env.AUTONOMOUS_EXECUTION_ENABLED = 'true';

      try {
        const approvedItem = await ActionApprovalCenter.proposeAction({
          websiteId: testSiteId,
          actionType: 'UPDATE_ROBOTS_TXT',
          targetUrl: 'https://audit-p0-test.com/robots.txt',
          payload: { robotsMeta: 'noindex, nofollow' },
          riskLevel: 'LEVEL_3_HIGH_RISK_MANUAL',
        });

        await ActionApprovalCenter.approveAction({
          actionId: approvedItem.id,
          userId: 'admin-usr',
        });

        // Try to execute with tampered payload
        await expect(
          ActionExecutionPipeline.execute({
            websiteId: testSiteId,
            actionType: 'UPDATE_ROBOTS_TXT',
            targetUrl: 'https://audit-p0-test.com/robots.txt',
            payload: { robotsMeta: 'index, follow' }, // Tampered
            approvalRequestId: approvedItem.id,
            idempotencyKey: `audit-tamper-${Date.now()}`,
            executionMode: 'AUTONOMOUS',
          })
        ).rejects.toThrow(/APPROVAL_INTENT_MISMATCH/);
      } finally {
        process.env.AUTONOMOUS_EXECUTION_ENABLED = originalFlag;
      }
    });
  });

  describe('P0-8 & P0-9: Production Auth & Principal Resolution', () => {
    it('ProductionAuthenticationProvider rejects unverified mock headers and invalid tokens', async () => {
      const prodAuth = new ProductionAuthenticationProvider();

      const mockReq = {
        headers: {
          'x-user-id': 'hacker-user',
          'x-user-role': 'ADMIN',
        },
      } as unknown as Request;

      const principal = await prodAuth.authenticate(mockReq);
      expect(principal).toBeNull();
    });

    it('DevelopmentAuthenticationProvider allows headers in dev/test', async () => {
      const devAuth = new DevelopmentAuthenticationProvider();

      const mockReq = {
        headers: {
          'x-user-id': 'dev-user-test',
          'x-user-role': 'ADMIN',
        },
      } as unknown as Request;

      const principal = await devAuth.authenticate(mockReq);
      expect(principal).not.toBeNull();
      expect(principal?.userId).toBe('dev-user-test');
    });
  });

  describe('P0-11 & P0-12: Explicit CMS Provider Mode & WordPress Remote Auth', () => {
    it('WordPressCmsProvider enforces mode and requires credentials for remote operations in PRODUCTION mode', async () => {
      const prodWpProvider = new WordPressCmsProvider('PRODUCTION', {
        endpointUrl: 'https://my-wordpress.com',
      });

      expect(prodWpProvider.mode).toBe('PRODUCTION');

      // Mutation without credentials throws in production mode
      await expect(
        prodWpProvider.setCanonicalUrl('https://my-wordpress.com/page', 'https://my-wordpress.com/canonical')
      ).rejects.toThrow(/WORDPRESS_AUTH_REQUIRED/);
    });

    it('WordPressCmsProvider in SIMULATION mode allows safe local state execution', async () => {
      const simProvider = new WordPressCmsProvider('SIMULATION');
      expect(simProvider.mode).toBe('SIMULATION');

      const result = await simProvider.setCanonicalUrl('https://example.com/page', 'https://example.com/canonical');
      expect(result.success).toBe(true);

      const observed = await simProvider.getCanonicalUrl('https://example.com/page');
      expect(observed).toBe('https://example.com/canonical');
    });
  });

  describe('P0-13 & P0-14: Independent Verification & Database-backed Metrics', () => {
    it('ProductionHttpVerifier rejects SSRF targets (private IPs and cloud metadata)', async () => {
      await expect(
        ProductionHttpVerifier.verifyLiveUrl('http://169.254.169.254/latest/meta-data')
      ).rejects.toThrow();

      await expect(
        ProductionHttpVerifier.verifyLiveUrl('http://127.0.0.1:8080/admin')
      ).rejects.toThrow();
    });

    it('VerificationEngine queries real GSC facts when metrics are not passed', async () => {
      // Seed GSC analytics fact for target URL
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: testSiteId,
          pageUrl: 'https://audit-p0-test.com/verified-page',
          query: 'seo keyword',
          clicks: 250,
          impressions: 5000,
          position: 4.2,
          ctr: 0.05,
          date: new Date(),
        },
      });

      // Create an action execution record
      const execution = await prisma.actionExecution.create({
        data: {
          websiteId: testSiteId,
          actionType: 'TITLE_TAG_OPTIMIZATION',
          targetUrl: 'https://audit-p0-test.com/verified-page',
          idempotencyKey: `verif-test-${Date.now()}`,
          state: 'EXECUTING',
        },
      });

      // Run Stage 2 without passing gscIndexed explicitly -> verifies from DB facts
      const stage2Result = await VerificationEngine.runStage2IndexSerpVerification({
        actionExecutionId: execution.id,
        websiteId: testSiteId,
        targetUrl: 'https://audit-p0-test.com/verified-page',
      });

      expect(stage2Result.passed).toBe(true);
      expect(stage2Result.observedData.gscIndexed).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { ActionExecutionRepository } from '../server/repositories/actionExecutionRepository';

describe('ActionExecution & ActionVerification Idempotency', () => {
  beforeEach(async () => {
    await ActionExecutionRepository.clearForTesting();
  });

  it('submitting same ActionExecution logical idempotency key twice returns single action', async () => {
    const key = `action-key-${Date.now()}`;
    const result1 = await ActionExecutionRepository.submitActionExecution({
      websiteId: 'site-techscale-prod',
      actionType: 'TITLE_TAG_DEPLOY',
      targetUrl: 'https://techscale.io/pricing',
      idempotencyKey: key,
      requestedByUserId: 'user-001',
      beforeEvidenceJson: JSON.stringify({ title: 'Old Title' }),
    });

    expect(result1.isDuplicate).toBe(false);
    expect(result1.action.idempotencyKey).toBe(key);
    expect(result1.action.state).toBe('PENDING_APPROVAL');

    // Second submission with exact same idempotencyKey
    const result2 = await ActionExecutionRepository.submitActionExecution({
      websiteId: 'site-techscale-prod',
      actionType: 'TITLE_TAG_DEPLOY',
      targetUrl: 'https://techscale.io/pricing',
      idempotencyKey: key,
      requestedByUserId: 'user-001',
    });

    expect(result2.isDuplicate).toBe(true);
    expect(result2.action.id).toBe(result1.action.id);
  });

  it('records verification and transitions action state to VERIFIED_COMPLETED on match', async () => {
    const key = `action-verify-key-${Date.now()}`;
    const { action } = await ActionExecutionRepository.submitActionExecution({
      websiteId: 'site-techscale-prod',
      actionType: 'SCHEMA_INJECTION',
      targetUrl: 'https://techscale.io/docs',
      idempotencyKey: key,
    });

    const verification = await ActionExecutionRepository.recordVerification({
      actionExecutionId: action.id,
      expectedStateJson: JSON.stringify({ schemaType: 'TechArticle' }),
      observedStateJson: JSON.stringify({ schemaType: 'TechArticle' }),
      isMatch: true,
      varianceNotes: 'Exact matching JSON-LD script tag discovered in live DOM',
    });

    expect(verification.status).toBe('VERIFIED_COMPLETED');
    expect(verification.isMatch).toBe(true);

    const updatedAction = await ActionExecutionRepository.getById(action.id);
    expect(updatedAction?.state).toBe('VERIFIED_COMPLETED');
  });

  it('records verification and transitions action state to UNVERIFIED_BLOCKED on mismatch', async () => {
    const key = `action-mismatch-key-${Date.now()}`;
    const { action } = await ActionExecutionRepository.submitActionExecution({
      websiteId: 'site-techscale-prod',
      actionType: 'CANONICAL_FIX',
      targetUrl: 'https://techscale.io/blog',
      idempotencyKey: key,
    });

    const verification = await ActionExecutionRepository.recordVerification({
      actionExecutionId: action.id,
      expectedStateJson: JSON.stringify({ canonical: 'https://techscale.io/blog' }),
      observedStateJson: JSON.stringify({ canonical: 'https://techscale.io/old-blog' }),
      isMatch: false,
      varianceNotes: 'Observed canonical tag points to legacy URL structure',
    });

    expect(verification.status).toBe('UNVERIFIED_BLOCKED');
    expect(verification.isMatch).toBe(false);

    const updatedAction = await ActionExecutionRepository.getById(action.id);
    expect(updatedAction?.state).toBe('UNVERIFIED_BLOCKED');
  });
});

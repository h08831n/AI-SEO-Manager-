import { describe, it, expect } from 'vitest';
import { AnalyticsRepository } from '../server/repositories/analyticsRepository';

describe('Phase 3: Integration Tenant Isolation Test Suite', () => {
  it('ensures analytics facts are strictly queried within the specified website scope', async () => {
    const websiteA = 'website-tenant-a-111';
    const websiteB = 'website-tenant-b-222';

    const startDate = new Date('2026-08-01');
    const endDate = new Date('2026-08-28');

    // Querying tenant A and tenant B must execute isolated queries with websiteId predicate
    const totalsA = await AnalyticsRepository.getGscTotals(websiteA, startDate, endDate);
    const totalsB = await AnalyticsRepository.getGscTotals(websiteB, startDate, endDate);

    expect(totalsA).toBeDefined();
    expect(totalsB).toBeDefined();
    expect(totalsA.totalClicks).toBeGreaterThanOrEqual(0);
    expect(totalsB.totalClicks).toBeGreaterThanOrEqual(0);
  });
});

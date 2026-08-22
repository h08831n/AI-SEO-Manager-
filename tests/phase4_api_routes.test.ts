import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { createApp } from '../server/app';
import { prisma } from '../server/db/prisma';

describe('Phase 4: REST API Endpoints & Multi-Tenant Access Control', () => {
  let server: http.Server;
  let baseUrl: string;
  let websiteId: string;
  const testDomain = 'analytics-cloud.dev';

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(async () => {
    const website = await prisma.website.create({
      data: {
        workspaceId: 'default-workspace',
        domain: testDomain,
        name: 'Analytics Cloud',
        productionUrl: `https://${testDomain}`,
      } as any,
    });
    websiteId = website.id;
  });

  it('creates and lists keywords in the keyword universe with intent classification', async () => {
    // 1. Create Keyword
    const createRes = await fetch(`${baseUrl}/api/keywords/websites/${websiteId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'EDITOR',
      },
      body: JSON.stringify({
        keyword: 'best real time analytics database pricing',
        conversionGoal: 'Free Trial',
        priority: 1,
      }),
    });

    const createJson: any = await createRes.json();
    expect(createRes.status).toBe(201);
    expect(createJson.success).toBe(true);
    expect(createJson.keyword.searchIntent).toBe('TRANSACTIONAL');
    expect(createJson.keyword.businessValue).toBe('TIER_1_CRITICAL');

    const kwId = createJson.keyword.id;

    // 2. List Keywords
    const listRes = await fetch(`${baseUrl}/api/keywords/websites/${websiteId}?moneyKeyword=true`, {
      headers: {
        'x-user-role': 'VIEWER',
      },
    });

    const listJson: any = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(listJson.total).toBe(1);
    expect(listJson.items[0].id).toBe(kwId);
  });

  it('triggers immediate SERP check and returns rank, visibility and features', async () => {
    const createRes = await fetch(`${baseUrl}/api/keywords/websites/${websiteId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'EDITOR',
      },
      body: JSON.stringify({
        keyword: 'enterprise log indexing tool',
      }),
    });

    const createJson: any = await createRes.json();
    const kwId = createJson.keyword.id;

    // Trigger SERP check
    const checkRes = await fetch(`${baseUrl}/api/serp/websites/${websiteId}/keywords/${kwId}/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'EDITOR',
      },
      body: JSON.stringify({ device: 'DESKTOP' }),
    });

    const checkJson: any = await checkRes.json();
    expect(checkRes.status).toBe(200);
    expect(checkJson.success).toBe(true);
    expect(checkJson.snapshotId).toBeDefined();
    expect(checkJson.visibility).toBeDefined();

    // Fetch snapshot
    const snapRes = await fetch(`${baseUrl}/api/serp/websites/${websiteId}/keywords/${kwId}/snapshot`, {
      headers: {
        'x-user-role': 'VIEWER',
      },
    });

    const snapJson: any = await snapRes.json();
    expect(snapRes.status).toBe(200);
    expect(snapJson.snapshot.serpItems.length).toBeGreaterThan(0);
  });

  it('manages competitor intelligence and exclusions', async () => {
    // Exclude platform domain
    const excludeRes = await fetch(`${baseUrl}/api/competitors/websites/${websiteId}/exclusions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'EDITOR',
      },
      body: JSON.stringify({
        domain: 'aggregatordirectory.com',
        isExcluded: true,
        reason: 'NON_COMPETING_DIRECTORY',
      }),
    });

    const excludeJson: any = await excludeRes.json();
    expect(excludeRes.status).toBe(200);
    expect(excludeJson.competitor.isExcluded).toBe(true);

    // List competitors
    const listRes = await fetch(`${baseUrl}/api/competitors/websites/${websiteId}`, {
      headers: {
        'x-user-role': 'VIEWER',
      },
    });

    const listJson: any = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listJson.competitors)).toBe(true);
  });

  it('enforces RBAC permissions on mutating keyword actions', async () => {
    const res = await fetch(`${baseUrl}/api/keywords/websites/${websiteId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'unprivileged-user-1',
        'x-user-role': 'VIEWER', // VIEWER lacks EDITOR role
      },
      body: JSON.stringify({
        keyword: 'unauthorized attempt',
      }),
    });

    expect(res.status).toBe(403);
  });
});

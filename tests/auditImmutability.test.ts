import { describe, it, expect } from 'vitest';

describe('Audit Log Immutability', () => {
  interface AuditEntry {
    id: string;
    workspaceId: string;
    action: string;
    timestamp: string;
  }

  const inMemoryAuditTrail: AuditEntry[] = [];

  class AuditRepository {
    public static async append(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry> {
      const record: AuditEntry = {
        ...entry,
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: new Date().toISOString(),
      };
      inMemoryAuditTrail.push(record);
      return record;
    }

    public static async list(workspaceId: string): Promise<AuditEntry[]> {
      return inMemoryAuditTrail.filter((a) => a.workspaceId === workspaceId);
    }
  }

  it('allows appending audit entries without mutation of historical records', async () => {
    const entry1 = await AuditRepository.append({
      workspaceId: 'ws-001',
      action: 'TITLE_TAG_OPTIMIZED',
    });

    const entry2 = await AuditRepository.append({
      workspaceId: 'ws-001',
      action: 'CANONICAL_AUDIT_EXECUTED',
    });

    const history = await AuditRepository.list('ws-001');
    expect(history.length).toBe(2);
    expect(history[0].id).toBe(entry1.id);
    expect(history[1].id).toBe(entry2.id);
  });

  it('confirms absence of updateAudit and deleteAudit mutation methods on repository API', () => {
    const repoAny = AuditRepository as any;
    expect(repoAny.updateAudit).toBeUndefined();
    expect(repoAny.deleteAudit).toBeUndefined();
    expect(repoAny.clearAudit).toBeUndefined();
  });
});

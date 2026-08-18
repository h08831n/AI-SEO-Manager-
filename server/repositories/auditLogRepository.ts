export interface AuditLogRecord {
  id: string;
  websiteId: string;
  userId?: string | null;
  actionName: string;
  affectedUrl: string;
  triggeredBy: string; // MANUAL_USER, 1_CLICK_EXECUTION, SIMULATION
  reason: string;
  beforeStateJson?: string | null;
  afterStateJson?: string | null;
  isReversible: boolean;
  isReverted: boolean;
  correlationId: string;
  timestamp: string;
}

const auditLogsStore: AuditLogRecord[] = [];

// Add initial bootstrap audit entry
auditLogsStore.push({
  id: 'audit-boot-01',
  websiteId: 'site-techscale-prod',
  userId: 'usr-admin-system',
  actionName: 'TENANT_BOOTSTRAP',
  affectedUrl: 'https://techscale.io',
  triggeredBy: 'SYSTEM_BOOT',
  reason: 'Initial security and tenancy boundaries provisioned.',
  beforeStateJson: null,
  afterStateJson: JSON.stringify({ domain: 'techscale.io', workspaceId: 'ws-techscale-org' }),
  isReversible: false,
  isReverted: false,
  correlationId: 'corr-init-1',
  timestamp: new Date().toISOString(),
});

export class AuditLogRepository {
  public static async log(entry: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    auditLogsStore.unshift(record); // newest first
    return record;
  }

  public static async listForWebsite(websiteId: string, limit = 50): Promise<AuditLogRecord[]> {
    return auditLogsStore.filter((a) => a.websiteId === websiteId).slice(0, limit);
  }
}

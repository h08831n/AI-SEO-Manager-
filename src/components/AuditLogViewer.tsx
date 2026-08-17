import React from 'react';
import { AuditLogEntry } from '../types';
import {
  Terminal,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  onRollback: (logId: string) => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  logs,
  onRollback,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Terminal className="h-4 w-4" />
            <span>IMMUTABLE AUDIT TRAIL & TRANSACTION LOGS</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Audit Trail & Reversible Rollback Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Every autonomous execution, title tag modification, schema deployment, and structural redirect is logged with full prior state payloads for instant rollback.
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="py-3 px-4">Timestamp & ID</th>
                <th className="py-3 px-4">Action & Trigger</th>
                <th className="py-3 px-4">Affected Entity</th>
                <th className="py-3 px-4">Reason & Justification</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-850 transition-colors">
                  <td className="py-3 px-4 font-mono">
                    <span className="text-white font-bold block">{log.timestamp}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.id}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-emerald-400 block">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">By: {log.triggeredBy}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300 max-w-[200px] truncate">
                    {log.affectedUrl}
                  </td>
                  <td className="py-3 px-4 text-slate-300 max-w-xs">
                    {log.reason}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {log.reverted ? (
                      <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                        Reverted
                      </span>
                    ) : (
                      <button
                        onClick={() => onRollback(log.id)}
                        className="px-3 py-1 bg-rose-950/50 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded text-xs font-semibold flex items-center space-x-1 ml-auto transition-all"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Rollback</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

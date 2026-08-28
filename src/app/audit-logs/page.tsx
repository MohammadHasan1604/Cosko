'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';

export default function AuditLogsPage() {
  const { auditLogs } = useApp();
  const [filterModule, setFilterModule] = useState('All');

  const filteredLogs = filterModule === 'All'
    ? auditLogs
    : auditLogs.filter((l) => l.module === filterModule);

  return (
    <AppLayout activeRoute="/audit-logs">
      <div className="space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Audit Logs & Security Trail</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Immutable audit trail recording all user transactions, stock adjustments, role changes, and IP addresses.
            </p>
          </div>

          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="input-field py-2 text-sm w-auto min-w-[160px]"
          >
            <option value="All">All Modules</option>
            <option value="Inventory">Inventory</option>
            <option value="Sales">Sales</option>
            <option value="Authentication">Authentication</option>
            <option value="Organization">Organization</option>
          </select>
        </div>

        {/* Audit Logs Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted text-2xs font-bold uppercase text-muted-foreground">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User & Role</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Audit Details</th>
                  <th className="px-4 py-3 font-mono">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredLogs.map((log) => (
                  <tr key={`audit-${log.id}`} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5 text-2xs text-muted-foreground font-mono">{log.timestamp}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-foreground">{log.userName}</p>
                      <p className="text-2xs text-muted-foreground">{log.userRole}</p>
                    </td>
                    <td className="px-4 py-3.5"><span className="badge-info text-2xs">{log.module}</span></td>
                    <td className="px-4 py-3.5 font-semibold text-foreground text-xs">{log.action}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-md truncate" title={log.details}>{log.details}</td>
                    <td className="px-4 py-3.5 font-mono text-2xs text-muted-foreground">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

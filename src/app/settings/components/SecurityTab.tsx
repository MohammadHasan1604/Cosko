'use client';

import React from 'react';
import ToggleSwitch from '@/components/ui/ToggleSwitch';

interface SecurityTabProps {
  sessionTimeoutMins: number;
  setSessionTimeoutMins: (val: number) => void;
  maxLoginAttempts: number;
  setMaxLoginAttempts: (val: number) => void;
  enforcePasswordPolicy: boolean;
  setEnforcePasswordPolicy: (val: boolean) => void;
  sensitiveActionConfirm: boolean;
  setSensitiveActionConfirm: (val: boolean) => void;
  isSuperAdmin: boolean;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
  sessionTimeoutMins,
  setSessionTimeoutMins,
  maxLoginAttempts,
  setMaxLoginAttempts,
  enforcePasswordPolicy,
  setEnforcePasswordPolicy,
  sensitiveActionConfirm,
  setSensitiveActionConfirm,
  isSuperAdmin,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h3 className="text-base font-bold text-foreground">System Security & Access Controls</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Session timeouts, rate limiting, and password enforcement rules.
        </p>
      </div>

      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1">
              Inactivity Session Timeout (Minutes · 30 Days = 43200m)
            </label>
            <input
              type="number"
              min="5"
              max="43200"
              disabled={!isSuperAdmin}
              value={sessionTimeoutMins}
              onChange={(e) => setSessionTimeoutMins(Number(e.target.value))}
              className="input-field text-xs font-mono"
            />
            <p className="text-3xs text-muted-foreground mt-0.5">
              Global policy across all users (Default: 43,200 minutes / 30 days).
            </p>
          </div>
          <div>
            <label className="font-bold text-foreground block mb-1">
              Max Failed Login Attempts
            </label>
            <input
              type="number"
              min="3"
              max="10"
              disabled={!isSuperAdmin}
              value={maxLoginAttempts}
              onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
              className="input-field text-xs font-mono"
            />
            <p className="text-3xs text-muted-foreground mt-0.5">
              Temporary account lockout threshold to prevent brute-force.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/60">
            <div>
              <span className="font-bold text-foreground block text-xs">
                Enterprise Password Policy
              </span>
              <span className="text-3xs text-muted-foreground block">
                Enforce enterprise password complexity (min 8 chars, uppercase, digit, special
                character).
              </span>
            </div>
            <ToggleSwitch
              id="policy"
              disabled={!isSuperAdmin}
              checked={enforcePasswordPolicy}
              onChange={setEnforcePasswordPolicy}
              size="sm"
              onText="ON"
              offText="OFF"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/60">
            <div>
              <span className="font-bold text-foreground block text-xs">
                Secondary Action Confirmation
              </span>
              <span className="text-3xs text-muted-foreground block">
                Require secondary confirmation for sensitive actions (void sales, inventory
                write-offs).
              </span>
            </div>
            <ToggleSwitch
              id="sensitive"
              disabled={!isSuperAdmin}
              checked={sensitiveActionConfirm}
              onChange={setSensitiveActionConfirm}
              size="sm"
              onText="ON"
              offText="OFF"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import ToggleSwitch from '@/components/ui/ToggleSwitch';

interface TaxTabProps {
  gstin: string;
  handleGstinChange: (val: string) => void;
  isGstinValid: boolean;
  gstRegistrationType: string;
  setGstRegistrationType: (val: string) => void;
  legalBusinessName: string;
  setLegalBusinessName: (val: string) => void;
  tradeName: string;
  setTradeName: (val: string) => void;
  gstStateCode: string;
  setGstStateCode: (val: string) => void;
  gstState: string;
  setGstState: (val: string) => void;
  gstBusinessAddress: string;
  setGstBusinessAddress: (val: string) => void;
  defaultTaxRate: number;
  setDefaultTaxRate: (rate: number) => void;
  hsnMandatory: boolean;
  setHsnMandatory: (val: boolean) => void;
  enableReverseCharge: boolean;
  setEnableReverseCharge: (val: boolean) => void;
  isSuperAdmin: boolean;
  indianStates: Record<string, string>;
}

export const TaxTab: React.FC<TaxTabProps> = ({
  gstin,
  handleGstinChange,
  isGstinValid,
  gstRegistrationType,
  setGstRegistrationType,
  legalBusinessName,
  setLegalBusinessName,
  tradeName,
  setTradeName,
  gstStateCode,
  setGstStateCode,
  gstState,
  setGstState,
  gstBusinessAddress,
  setGstBusinessAddress,
  defaultTaxRate,
  setDefaultTaxRate,
  hsnMandatory,
  setHsnMandatory,
  enableReverseCharge,
  setEnableReverseCharge,
  isSuperAdmin,
  indianStates,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h3 className="text-base font-bold text-foreground">India GST & Business Tax Profile</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Goods and Services Tax (GST) registration, state determination, and tax calculation rules.
        </p>
      </div>

      {/* GSTIN Validation Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
          isGstinValid && gstin
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            : gstin
              ? 'bg-danger/10 border-danger/30 text-danger'
              : 'bg-muted/40 border-border text-muted-foreground'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon
            name={isGstinValid && gstin ? 'CheckCircleIcon' : 'ExclamationCircleIcon'}
            size={22}
          />
          <div>
            <h4 className="text-xs font-bold">
              {isGstinValid && gstin
                ? `Valid India GSTIN (${gstStateCode} - ${gstState})`
                : gstin
                  ? 'Invalid GSTIN Format (Expected: 2-digit state + 10-char PAN + 1 entity + Z + 1 checksum)'
                  : 'No GSTIN Configured'}
            </h4>
            <p className="text-3xs opacity-80 mt-0.5">
              {gstin
                ? `PAN: ${gstin.slice(2, 12)} · State: ${gstState}`
                : 'Enter your 15-digit GSTIN below to enable GST invoicing.'}
            </p>
          </div>
        </div>
        {gstin && (
          <span
            className={`px-2.5 py-1 rounded-full text-2xs font-mono font-bold uppercase ${
              isGstinValid ? 'bg-emerald-500/20 text-emerald-600' : 'bg-danger/20 text-danger'
            }`}
          >
            {isGstinValid ? 'VERIFIED FORMAT' : 'INVALID'}
          </span>
        )}
      </div>

      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1">GSTIN (15 Digits) *</label>
            <input
              type="text"
              maxLength={15}
              required
              disabled={!isSuperAdmin}
              value={gstin}
              onChange={(e) => handleGstinChange(e.target.value)}
              placeholder="e.g. 29AABCU9603R1ZM"
              className="input-field text-xs font-mono font-bold tracking-wider"
            />
          </div>
          <div>
            <label className="font-bold text-foreground block mb-1">GST Registration Type</label>
            <select
              disabled={!isSuperAdmin}
              value={gstRegistrationType}
              onChange={(e) => setGstRegistrationType(e.target.value)}
              className="input-field text-xs"
            >
              <option value="Regular">Regular Taxpayer (Default)</option>
              <option value="Composition">Composition Scheme</option>
              <option value="SEZ Unit">Special Economic Zone (SEZ) Unit</option>
              <option value="SEZ Developer">SEZ Developer</option>
              <option value="ISD">Input Service Distributor (ISD)</option>
              <option value="Casual">Casual Taxable Person</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1">
              Legal Business Name (As per GST)
            </label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={legalBusinessName}
              onChange={(e) => setLegalBusinessName(e.target.value)}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="font-bold text-foreground block mb-1">Trade Name</label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1">State Code</label>
            <input
              type="text"
              maxLength={2}
              disabled={!isSuperAdmin}
              value={gstStateCode}
              onChange={(e) => {
                const code = e.target.value;
                setGstStateCode(code);
                if (indianStates[code]) setGstState(indianStates[code]);
              }}
              className="input-field text-xs font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="font-bold text-foreground block mb-1">Registered GST State</label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={gstState}
              onChange={(e) => setGstState(e.target.value)}
              className="input-field text-xs"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1">
            Principal Place of Business (GST Address)
          </label>
          <textarea
            rows={2}
            disabled={!isSuperAdmin}
            value={gstBusinessAddress}
            onChange={(e) => setGstBusinessAddress(e.target.value)}
            placeholder="Full registered address matching GST certificate..."
            className="input-field text-xs"
          />
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1">Default POS Tax Rate (%)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="28"
              step="0.5"
              disabled={!isSuperAdmin}
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
              className="input-field text-xs w-32 font-bold"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {[0, 5, 12, 18, 28].map((rate) => (
                <button
                  key={`rate-${rate}`}
                  type="button"
                  disabled={!isSuperAdmin}
                  onClick={() => setDefaultTaxRate(rate)}
                  className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all ${
                    defaultTaxRate === rate
                      ? 'bg-primary text-white'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/60">
            <div>
              <span className="font-bold text-foreground block text-xs">
                Enforce Mandatory HSN/SAC Codes
              </span>
              <span className="text-3xs text-muted-foreground block">
                Require valid HSN/SAC classification on all invoice line items.
              </span>
            </div>
            <ToggleSwitch
              id="hsn"
              disabled={!isSuperAdmin}
              checked={hsnMandatory}
              onChange={setHsnMandatory}
              size="sm"
              onText="ON"
              offText="OFF"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/60">
            <div>
              <span className="font-bold text-foreground block text-xs">
                Reverse Charge Mechanism (RCM)
              </span>
              <span className="text-3xs text-muted-foreground block">
                Enable Reverse Charge Mechanism applicability flag on B2B invoices.
              </span>
            </div>
            <ToggleSwitch
              id="rcm"
              disabled={!isSuperAdmin}
              checked={enableReverseCharge}
              onChange={setEnableReverseCharge}
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

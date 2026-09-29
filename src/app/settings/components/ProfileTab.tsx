'use client';

import React from 'react';

interface ProfileTabProps {
  businessName: string;
  setBusinessName: (name: string) => void;
  supportEmail: string;
  setSupportEmail: (email: string) => void;
  supportPhone: string;
  setSupportPhone: (phone: string) => void;
  businessAddress: string;
  setBusinessAddress: (address: string) => void;
  city: string;
  setCity: (city: string) => void;
  state: string;
  setState: (state: string) => void;
  pincode: string;
  setPincode: (pin: string) => void;
  baseCurrency: string;
  setBaseCurrency: (currency: string) => void;
  isSuperAdmin: boolean;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  businessName,
  setBusinessName,
  supportEmail,
  setSupportEmail,
  supportPhone,
  setSupportPhone,
  businessAddress,
  setBusinessAddress,
  city,
  setCity,
  state,
  setState,
  pincode,
  setPincode,
  baseCurrency,
  setBaseCurrency,
  isSuperAdmin,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h3 className="text-base font-bold text-foreground">
          Global Business & Enterprise Profile
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Authoritative headquarters, contact information, and default currency applied to invoices
          and receipts.
        </p>
      </div>

      <div className="space-y-4 text-xs">
        <div>
          <label className="font-bold text-foreground block mb-1">Registered Business Name *</label>
          <input
            type="text"
            required
            disabled={!isSuperAdmin}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. COSKO Retail Enterprise Private Limited"
            className="input-field text-xs font-bold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1">Official Support Email *</label>
            <input
              type="email"
              required
              disabled={!isSuperAdmin}
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="font-bold text-foreground block mb-1">Central Phone / Hotline</label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="+91 80 4000 8800"
              className="input-field text-xs"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1">
            Registered Corporate Address
          </label>
          <textarea
            rows={2}
            disabled={!isSuperAdmin}
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            placeholder="Headquarters street address, landmark..."
            className="input-field text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1">City</label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="font-bold text-foreground block mb-1">State / Province</label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="font-bold text-foreground block mb-1">
              PIN / Postal Code (6 Digits)
            </label>
            <input
              type="text"
              maxLength={6}
              disabled={!isSuperAdmin}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="560038"
              className="input-field text-xs font-mono"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1">Base Store Currency</label>
          <select
            disabled={!isSuperAdmin}
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="input-field text-xs"
          >
            <option value="INR (₹)">INR (₹) — Indian Rupee (Default)</option>
            <option value="USD ($)">USD ($) — US Dollar</option>
            <option value="EUR (€)">EUR (€) — Euro</option>
            <option value="AED (د.إ)">AED (د.إ) — UAE Dirham</option>
          </select>
        </div>
      </div>
    </div>
  );
};

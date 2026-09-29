'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import CoskoLogo from '@/components/ui/CoskoLogo';

interface BrandingTabProps {
  appName: string;
  setAppName: (name: string) => void;
  tagline: string;
  setTagline: (tagline: string) => void;
  supportEmailBranding: string;
  setSupportEmailBranding: (email: string) => void;
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  faviconUrl: string | null;
  setFaviconUrl: (url: string | null) => void;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFaviconUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleResetBrandingTab: () => void;
  isSuperAdmin: boolean;
}

export const BrandingTab: React.FC<BrandingTabProps> = ({
  appName,
  setAppName,
  tagline,
  setTagline,
  supportEmailBranding,
  setSupportEmailBranding,
  logoUrl,
  setLogoUrl,
  faviconUrl,
  setFaviconUrl,
  handleLogoUpload,
  handleFaviconUpload,
  handleResetBrandingTab,
  isSuperAdmin,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h3 className="text-base font-bold text-foreground">App White-Label Branding & Identity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize the brand identity, logo, favicon, and customer-facing identity across
          dashboard, sidebar, and print views.
        </p>
      </div>

      {/* Live Preview Card */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            Live App Header & Logo Preview
          </span>
          <span className="text-3xs text-emerald-500 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Real-time sync active
          </span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border w-fit shadow-xs">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Custom Business Logo"
              className="w-10 h-10 object-contain rounded-lg border border-border bg-white"
            />
          ) : (
            <CoskoLogo size={32} showText={false} />
          )}
          <div>
            <h4 className="text-sm font-bold text-foreground">{appName || 'COSKO'}</h4>
            <p className="text-2xs text-muted-foreground">
              {tagline || 'Multi-Store Enterprise Retail System'}
            </p>
          </div>
        </div>
      </div>

      {/* Branding Controls */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Application / Brand Name *
          </label>
          <input
            type="text"
            required
            disabled={!isSuperAdmin}
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="e.g. COSKO Stores"
            className="input-field text-xs font-bold"
          />
          <p className="text-2xs text-muted-foreground mt-1">
            Displays on the sidebar, header, login screen, and printed receipts.
          </p>
        </div>

        {/* Logo & Favicon Upload Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Logo */}
          <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
            <label className="text-xs font-bold text-foreground block">Brand Logo Image</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border border-dashed border-border bg-card flex items-center justify-center p-1 relative overflow-hidden bg-white/5">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Icon name="PhotoIcon" size={24} className="text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1.5">
                {isSuperAdmin && (
                  <label className="btn-secondary text-xs cursor-pointer gap-2 inline-flex items-center">
                    <Icon name="ArrowUpTrayIcon" size={14} />
                    Upload Logo
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                )}
                {logoUrl && isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="btn-ghost text-xs text-danger hover:bg-danger/10 block"
                  >
                    Remove Logo
                  </button>
                )}
                <p className="text-3xs text-muted-foreground">PNG, JPG, WebP, SVG. Max 5MB.</p>
              </div>
            </div>
          </div>

          {/* Favicon */}
          <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
            <label className="text-xs font-bold text-foreground block">Browser Favicon</label>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg border border-dashed border-border bg-card flex items-center justify-center p-1 relative overflow-hidden">
                {faviconUrl ? (
                  <img src={faviconUrl} alt="Favicon" className="w-full h-full object-contain" />
                ) : (
                  <Icon name="GlobeAltIcon" size={20} className="text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1.5">
                {isSuperAdmin && (
                  <label className="btn-secondary text-xs cursor-pointer gap-2 inline-flex items-center">
                    <Icon name="ArrowUpTrayIcon" size={14} />
                    Upload Favicon
                    <input
                      type="file"
                      accept="image/png, image/x-icon, image/svg+xml"
                      onChange={handleFaviconUpload}
                      className="hidden"
                    />
                  </label>
                )}
                {faviconUrl && isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setFaviconUrl(null)}
                    className="btn-ghost text-xs text-danger hover:bg-danger/10 block"
                  >
                    Remove Favicon
                  </button>
                )}
                <p className="text-3xs text-muted-foreground">ICO, PNG, or SVG. Max 1MB.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Brand Tagline</label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Multi-Store Enterprise Retail System"
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Support Contact Email
            </label>
            <input
              type="email"
              disabled={!isSuperAdmin}
              value={supportEmailBranding}
              onChange={(e) => setSupportEmailBranding(e.target.value)}
              placeholder="support@cosko.com"
              className="input-field text-xs"
            />
          </div>
        </div>
      </div>

      {/* Reset to Default Button */}
      {isSuperAdmin && (
        <div className="pt-2 border-t border-border flex justify-between items-center">
          <button
            type="button"
            onClick={handleResetBrandingTab}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1.5"
          >
            <Icon name="ArrowPathIcon" size={13} />
            Reset to Default COSKO Branding
          </button>
        </div>
      )}
    </div>
  );
};

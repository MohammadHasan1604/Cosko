'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import CoskoLogo from '@/components/ui/CoskoLogo';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { branding, updateBranding, resetBranding } = useApp();
  const [activeTab, setActiveTab] = useState<'branding' | 'profile' | 'tax' | 'security' | 'alerts'>('branding');

  // White-Label Branding State
  const [appName, setAppName] = useState(branding.appName);
  const [logoUrl, setLogoUrl] = useState<string | null>(branding.logoUrl);
  const [tagline, setTagline] = useState(branding.tagline);
  const [supportEmailBranding, setSupportEmailBranding] = useState(branding.supportEmail);

  // Profile State
  const [businessName, setBusinessName] = useState('COSKO Retail Enterprise');
  const [supportEmail, setSupportEmail] = useState('support@cosko.com');
  const [supportPhone, setSupportPhone] = useState('+91 80 4000 8800');
  const [baseCurrency, setBaseCurrency] = useState('INR (₹)');

  // Tax State
  const [gstin, setGstin] = useState('29AABCU9603R1ZM');
  const [defaultTaxRate, setDefaultTaxRate] = useState(18);
  const [hsnMandatory, setHsnMandatory] = useState(true);

  // Security State
  const [twoFactorRequired, setTwoFactorRequired] = useState(true);
  const [sessionTimeoutMins, setSessionTimeoutMins] = useState(30);

  // Alerts State
  const [reorderEmailAlerts, setReorderEmailAlerts] = useState(true);
  const [dailySalesDigest, setDailySalesDigest] = useState(true);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File Validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type! Upload a PNG, JPG, WebP, or SVG logo image.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File size exceeds 5MB! Please upload a smaller logo image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoUrl(result);
      toast.success('Logo uploaded successfully! Click "Save Branding Settings" to apply.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    toast.info('Custom logo removed. Default COSKO branding icon will be used.');
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    updateBranding({
      appName: appName || 'COSKO',
      logoUrl,
      tagline,
      supportEmail: supportEmailBranding,
    });
  };

  const handleResetToDefault = () => {
    resetBranding();
    setAppName('COSKO');
    setLogoUrl(null);
    setTagline('Multi-Store Enterprise Retail & POS System');
    setSupportEmailBranding('support@cosko.com');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'branding') {
      handleSaveBranding(e);
    } else {
      toast.success('System settings saved successfully');
    }
  };

  return (
    <AppLayout activeRoute="/settings">
      <div className="space-y-6 fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Store & System Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            White-Label app branding, global business profile, GSTIN tax configuration, and automated stock alerts.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-2 flex-wrap justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {(
              [
                { id: 'branding', label: 'White-Label Branding', icon: 'SparklesIcon' },
                { id: 'profile', label: 'Business Profile', icon: 'BuildingStorefrontIcon' },
                { id: 'tax', label: 'Tax & Invoicing', icon: 'DocumentCheckIcon' },
                { id: 'security', label: 'Security & RBAC', icon: 'ShieldCheckIcon' },
                { id: 'alerts', label: 'Automated Alerts', icon: 'BellIcon' },
              ] as const
            ).map((tab) => (
              <button
                key={`tab-set-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab.icon as any} size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          <Link
            href="/settings/data-connections"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all shadow-xs"
          >
            <Icon name="CircleStackIcon" size={15} />
            <span>Legacy Data Connections</span>
          </Link>
        </div>

        {/* Tab Contents Form */}
        <form onSubmit={handleSaveSettings} className="card p-6 space-y-6">
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">App White-Label Branding & Custom Identity</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Personalize your application name, custom logo image, tagline, and support contact across the entire system.
                  </p>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Live App Header & Logo Preview</span>
                <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border w-fit shadow-xs">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Custom Business Logo" className="w-10 h-10 object-contain rounded-lg border border-border" />
                  ) : (
                    <CoskoLogo size={32} showText />
                  )}
                  {logoUrl && (
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{appName || 'COSKO'}</h4>
                      <p className="text-2xs text-muted-foreground">{tagline || 'Multi-Store Enterprise Retail System'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Branding Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Application / Business Name *</label>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g. Cosko Retail Enterprise"
                    className="input-field text-xs font-bold"
                  />
                  <p className="text-2xs text-muted-foreground mt-1">Displays on the sidebar, header, login screen, and printed receipts.</p>
                </div>

                {/* Logo Upload Section */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Custom Business Logo Image</label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-16 h-16 rounded-xl border border-dashed border-border bg-card flex items-center justify-center p-1 relative overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Icon name="PhotoIcon" size={24} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="btn-secondary text-xs cursor-pointer gap-2 inline-flex items-center">
                        <Icon name="ArrowUpTrayIcon" size={14} />
                        Upload Logo (PNG, JPG, SVG)
                        <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      {logoUrl && (
                        <button type="button" onClick={handleRemoveLogo} className="btn-ghost text-xs text-danger hover:bg-danger/10 block">
                          Remove Custom Logo
                        </button>
                      )}
                      <p className="text-2xs text-muted-foreground">Recommended size: 200×200px or SVG. Max 5MB.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Business Tagline</label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="e.g. Premium Hardware & Retail Solutions"
                      className="input-field text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1">Support Contact Email</label>
                    <input
                      type="email"
                      value={supportEmailBranding}
                      onChange={(e) => setSupportEmailBranding(e.target.value)}
                      placeholder="support@yourbusiness.com"
                      className="input-field text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Reset to Default Button */}
              <div className="pt-2">
                <button type="button" onClick={handleResetToDefault} className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1">
                  <Icon name="ArrowPathIcon" size={13} />
                  Reset to Default COSKO Theme
                </button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-foreground border-b border-border pb-2">Business Profile Details</h3>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Registered Business Name *</label>
                <input type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="input-field text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Support Email</label>
                  <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="input-field text-xs" />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Support Phone</label>
                  <input type="text" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className="input-field text-xs" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Base Store Currency</label>
                <input type="text" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} className="input-field text-xs" />
              </div>
            </div>
          )}

          {activeTab === 'tax' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-foreground border-b border-border pb-2">GSTIN Tax & Invoicing Rules</h3>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">GSTIN Registration Number *</label>
                <input type="text" required value={gstin} onChange={(e) => setGstin(e.target.value)} className="input-field text-xs font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Default POS Tax Rate (%)</label>
                <input type="number" min="0" max="28" value={defaultTaxRate} onChange={(e) => setDefaultTaxRate(Number(e.target.value))} className="input-field text-xs" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="hsn" checked={hsnMandatory} onChange={(e) => setHsnMandatory(e.target.checked)} className="rounded" />
                <label htmlFor="hsn" className="text-xs font-bold text-foreground cursor-pointer">Enforce Mandatory HSN/SAC Codes on Invoice Generation</label>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-foreground border-b border-border pb-2">Security & Access Control</h3>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="2fa" checked={twoFactorRequired} onChange={(e) => setTwoFactorRequired(e.target.checked)} className="rounded" />
                <label htmlFor="2fa" className="text-xs font-bold text-foreground cursor-pointer">Require Two-Factor Authentication (2FA) for Admin roles</label>
              </div>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Inactivity Session Timeout (Minutes)</label>
                <input type="number" min="5" value={sessionTimeoutMins} onChange={(e) => setSessionTimeoutMins(Number(e.target.value))} className="input-field text-xs" />
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-foreground border-b border-border pb-2">Automated Notifications Digest</h3>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="reorder" checked={reorderEmailAlerts} onChange={(e) => setReorderEmailAlerts(e.target.checked)} className="rounded" />
                <label htmlFor="reorder" className="text-xs font-bold text-foreground cursor-pointer">Send instant email alerts when inventory reaches reorder threshold</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="digest" checked={dailySalesDigest} onChange={(e) => setDailySalesDigest(e.target.checked)} className="rounded" />
                <label htmlFor="digest" className="text-xs font-bold text-foreground cursor-pointer">Send Daily Sales Summary PDF report to store managers at 09:00 PM</label>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <button type="submit" className="btn-primary gap-2 text-xs">
              <Icon name="CheckIcon" size={16} />
              {activeTab === 'branding' ? 'Save Branding Settings' : 'Save System Settings'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

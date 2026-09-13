'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import CoskoLogo from '@/components/ui/CoskoLogo';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

// GSTIN Regex: 2 digit state code + 10-char PAN + 1 entity code + Z + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
};

export default function SettingsPage() {
  const { branding, updateBranding, resetBranding, systemSettings, updateSystemSettings, reloadSettings, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'branding' | 'profile' | 'tax' | 'invoice' | 'security' | 'alerts'>('branding');
  const [isSaving, setIsSaving] = useState(false);

  const isSuperAdmin = currentUser?.role === 'Super Admin';

  // ─── Tab 1: Branding State ───
  const [appName, setAppName] = useState(branding.appName || 'COSKO');
  const [logoUrl, setLogoUrl] = useState<string | null>(branding.logoUrl || null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(branding.faviconUrl || null);
  const [tagline, setTagline] = useState(branding.tagline || '');
  const [supportEmailBranding, setSupportEmailBranding] = useState(branding.supportEmail || 'support@cosko.com');

  // ─── Tab 2: Profile State ───
  const [businessName, setBusinessName] = useState(branding.businessName || 'COSKO Retail Enterprise');
  const [supportEmail, setSupportEmail] = useState(branding.supportEmail || 'support@cosko.com');
  const [supportPhone, setSupportPhone] = useState(branding.supportPhone || '+91 80 4000 8800');
  const [businessAddress, setBusinessAddress] = useState(branding.businessAddress || '100 Feet Ring Road, Indiranagar');
  const [city, setCity] = useState(branding.city || 'Bengaluru');
  const [state, setState] = useState(branding.state || 'Karnataka');
  const [pincode, setPincode] = useState(branding.pincode || '560038');
  const [baseCurrency, setBaseCurrency] = useState(branding.baseCurrency || 'INR (₹)');

  // ─── Tab 3: Tax State ───
  const [gstin, setGstin] = useState(systemSettings.gstin || '29AABCU9603R1ZM');
  const [legalBusinessName, setLegalBusinessName] = useState(systemSettings.legalBusinessName || 'COSKO Retail Enterprise Private Limited');
  const [tradeName, setTradeName] = useState(systemSettings.tradeName || 'COSKO Stores');
  const [gstState, setGstState] = useState(systemSettings.gstState || 'Karnataka');
  const [gstStateCode, setGstStateCode] = useState(systemSettings.gstStateCode || '29');
  const [gstRegistrationType, setGstRegistrationType] = useState(systemSettings.gstRegistrationType || 'Regular');
  const [defaultTaxRate, setDefaultTaxRate] = useState(systemSettings.defaultTaxRate ?? 18);
  const [hsnMandatory, setHsnMandatory] = useState(systemSettings.hsnMandatory ?? true);
  const [enableReverseCharge, setEnableReverseCharge] = useState(systemSettings.enableReverseCharge ?? false);
  const [gstBusinessAddress, setGstBusinessAddress] = useState(systemSettings.gstBusinessAddress || '100 Feet Ring Road, Indiranagar, Bengaluru, Karnataka - 560038');

  // ─── Tab 4: Invoice Template State ───
  const [invoiceHeader, setInvoiceHeader] = useState(systemSettings.invoiceHeader || 'COSKO Retail Enterprise');
  const [invoiceFooter, setInvoiceFooter] = useState(systemSettings.invoiceFooter || 'Thank you for shopping with us! Goods once sold cannot be returned without original receipt.');
  const [invoiceTerms, setInvoiceTerms] = useState(systemSettings.invoiceTerms || '1. Standard 12-month warranty on manufacturing defects.\n2. Retain this invoice for warranty & service support.\n3. Physical and liquid damage are excluded.');
  const [invoiceAccentColor, setInvoiceAccentColor] = useState(systemSettings.invoiceAccentColor || 'primary');
  const [watermarkOpacity, setWatermarkOpacity] = useState(systemSettings.watermarkOpacity ?? 5);
  const [showStoreAddress, setShowStoreAddress] = useState(systemSettings.showStoreAddress ?? true);
  const [invoiceTemplateUrl, setInvoiceTemplateUrl] = useState<string | null>(systemSettings.invoiceTemplateUrl || null);
  const [showPaymentQr, setShowPaymentQr] = useState(systemSettings.showPaymentQr ?? false);
  const [paymentUpiId, setPaymentUpiId] = useState(systemSettings.paymentUpiId || 'cosko@icici');
  const [paymentBankDetails, setPaymentBankDetails] = useState(systemSettings.paymentBankDetails || 'HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234');

  // ─── Tab 5: Security State ───
  const [sessionTimeoutMins, setSessionTimeoutMins] = useState(systemSettings.sessionTimeoutMins ?? 30);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(systemSettings.maxLoginAttempts ?? 5);
  const [enforcePasswordPolicy, setEnforcePasswordPolicy] = useState(systemSettings.enforcePasswordPolicy ?? true);
  const [sensitiveActionConfirm, setSensitiveActionConfirm] = useState(systemSettings.sensitiveActionConfirm ?? true);

  // ─── Tab 6: Alerts State ───
  const [lowStockAlerts, setLowStockAlerts] = useState(systemSettings.lowStockAlerts ?? true);
  const [lowStockThreshold, setLowStockThreshold] = useState(systemSettings.lowStockThreshold ?? 5);
  const [overduePaymentAlerts, setOverduePaymentAlerts] = useState(systemSettings.overduePaymentAlerts ?? true);
  const [overdueThresholdDays, setOverdueThresholdDays] = useState(systemSettings.overdueThresholdDays ?? 30);
  const [dailySalesDigest, setDailySalesDigest] = useState(systemSettings.dailySalesDigest ?? false);
  const [securityEventAlerts, setSecurityEventAlerts] = useState(systemSettings.securityEventAlerts ?? true);
  const [alertRecipientEmails, setAlertRecipientEmails] = useState(systemSettings.alertRecipientEmails || 'alerts@cosko.com');

  // Sync state when context values update from server
  useEffect(() => {
    setAppName(branding.appName || 'COSKO');
    setLogoUrl(branding.logoUrl || null);
    setFaviconUrl(branding.faviconUrl || null);
    setTagline(branding.tagline || '');
    setSupportEmailBranding(branding.supportEmail || 'support@cosko.com');
    setBusinessName(branding.businessName || 'COSKO Retail Enterprise');
    setSupportEmail(branding.supportEmail || 'support@cosko.com');
    setSupportPhone(branding.supportPhone || '+91 80 4000 8800');
    setBusinessAddress(branding.businessAddress || '100 Feet Ring Road, Indiranagar');
    setCity(branding.city || 'Bengaluru');
    setState(branding.state || 'Karnataka');
    setPincode(branding.pincode || '560038');
    setBaseCurrency(branding.baseCurrency || 'INR (₹)');
  }, [branding]);

  useEffect(() => {
    if (systemSettings) {
      setGstin(systemSettings.gstin || '29AABCU9603R1ZM');
      setLegalBusinessName(systemSettings.legalBusinessName || 'COSKO Retail Enterprise Private Limited');
      setTradeName(systemSettings.tradeName || 'COSKO Stores');
      setGstState(systemSettings.gstState || 'Karnataka');
      setGstStateCode(systemSettings.gstStateCode || '29');
      setGstRegistrationType(systemSettings.gstRegistrationType || 'Regular');
      setDefaultTaxRate(systemSettings.defaultTaxRate ?? 18);
      setHsnMandatory(systemSettings.hsnMandatory ?? true);
      setEnableReverseCharge(systemSettings.enableReverseCharge ?? false);
      setGstBusinessAddress(systemSettings.gstBusinessAddress || '100 Feet Ring Road, Indiranagar, Bengaluru, Karnataka - 560038');

      setInvoiceHeader(systemSettings.invoiceHeader || 'COSKO Retail Enterprise');
      setInvoiceFooter(systemSettings.invoiceFooter || 'Thank you for shopping with us! Goods once sold cannot be returned without original receipt.');
      setInvoiceTerms(systemSettings.invoiceTerms || '1. Standard 12-month warranty on manufacturing defects.\n2. Retain this invoice for warranty & service support.\n3. Physical and liquid damage are excluded.');
      setInvoiceAccentColor(systemSettings.invoiceAccentColor || 'primary');
      setWatermarkOpacity(systemSettings.watermarkOpacity ?? 5);
      setShowStoreAddress(systemSettings.showStoreAddress ?? true);
      setInvoiceTemplateUrl(systemSettings.invoiceTemplateUrl || null);
      setShowPaymentQr(systemSettings.showPaymentQr ?? false);
      setPaymentUpiId(systemSettings.paymentUpiId || 'cosko@icici');
      setPaymentBankDetails(systemSettings.paymentBankDetails || 'HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234');

      setSessionTimeoutMins(systemSettings.sessionTimeoutMins ?? 30);
      setMaxLoginAttempts(systemSettings.maxLoginAttempts ?? 5);
      setEnforcePasswordPolicy(systemSettings.enforcePasswordPolicy ?? true);
      setSensitiveActionConfirm(systemSettings.sensitiveActionConfirm ?? true);

      setLowStockAlerts(systemSettings.lowStockAlerts ?? true);
      setLowStockThreshold(systemSettings.lowStockThreshold ?? 5);
      setOverduePaymentAlerts(systemSettings.overduePaymentAlerts ?? true);
      setOverdueThresholdDays(systemSettings.overdueThresholdDays ?? 30);
      setDailySalesDigest(systemSettings.dailySalesDigest ?? false);
      setSecurityEventAlerts(systemSettings.securityEventAlerts ?? true);
      setAlertRecipientEmails(systemSettings.alertRecipientEmails || 'alerts@cosko.com');
    }
  }, [systemSettings]);

  // Handle GSTIN change with state detection
  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    setGstin(upper);
    if (upper.length >= 2) {
      const code = upper.slice(0, 2);
      if (INDIAN_STATES[code]) {
        setGstStateCode(code);
        setGstState(INDIAN_STATES[code]);
      }
    }
  };

  const isGstinValid = !gstin || GSTIN_REGEX.test(gstin);

  // File Upload Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type! Upload a PNG, JPG, WebP, or SVG logo image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB! Please upload a smaller logo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoUrl(result);
      toast.success('Logo uploaded! Click "Save Branding Settings" to apply permanently.');
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('Favicon must be under 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFaviconUrl(reader.result as string);
      toast.success('Favicon uploaded! Click "Save Branding Settings" to apply.');
    };
    reader.readAsDataURL(file);
  };

  const handleInvoiceTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload an image (PNG, JPG, WebP, SVG) or PDF exported from Canva or design software.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Template size exceeds 10MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInvoiceTemplateUrl(reader.result as string);
      toast.success('Custom invoice template background loaded! Check live preview and save.');
    };
    reader.readAsDataURL(file);
  };

  // Section Save Handlers
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Permission denied: Only Super Admin can modify system settings.');
      return;
    }

    setIsSaving(true);
    try {
      if (activeTab === 'branding') {
        const payload = {
          appName: appName || 'COSKO',
          tagline,
          supportEmail: supportEmailBranding,
          logoUrl,
          faviconUrl,
        };
        const res = await updateSystemSettings('branding', payload);
        if (res.success) {
          updateBranding(payload);
        }
      } else if (activeTab === 'profile') {
        if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
          toast.error('Invalid Indian PIN Code. Must be exactly 6 digits.');
          setIsSaving(false);
          return;
        }
        await updateSystemSettings('profile', {
          businessName,
          supportEmail,
          supportPhone,
          businessAddress,
          city,
          state,
          pincode,
          baseCurrency,
        });
      } else if (activeTab === 'tax') {
        if (gstin && !GSTIN_REGEX.test(gstin)) {
          toast.error('Invalid GSTIN format! Example: 29AABCU9603R1ZM');
          setIsSaving(false);
          return;
        }
        await updateSystemSettings('tax', {
          gstin,
          legalBusinessName,
          tradeName,
          gstState,
          gstStateCode,
          gstRegistrationType,
          defaultTaxRate: Number(defaultTaxRate),
          hsnMandatory,
          enableReverseCharge,
          gstBusinessAddress,
        });
      } else if (activeTab === 'invoice') {
        await updateSystemSettings('invoice', {
          invoiceHeader,
          invoiceFooter,
          invoiceTerms,
          invoiceAccentColor,
          watermarkOpacity: Number(watermarkOpacity),
          showStoreAddress,
          invoiceTemplateUrl,
          showPaymentQr,
          paymentUpiId,
          paymentBankDetails,
        });
      } else if (activeTab === 'security') {
        await updateSystemSettings('security', {
          sessionTimeoutMins: Number(sessionTimeoutMins),
          maxLoginAttempts: Number(maxLoginAttempts),
          enforcePasswordPolicy,
          sensitiveActionConfirm,
        });
      } else if (activeTab === 'alerts') {
        await updateSystemSettings('alerts', {
          lowStockAlerts,
          lowStockThreshold: Number(lowStockThreshold),
          overduePaymentAlerts,
          overdueThresholdDays: Number(overdueThresholdDays),
          dailySalesDigest,
          securityEventAlerts,
          alertRecipientEmails,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetBrandingTab = () => {
    if (!isSuperAdmin) return;
    resetBranding();
    setAppName('COSKO');
    setLogoUrl(null);
    setFaviconUrl(null);
    setTagline('Multi-Store Enterprise Retail & POS System');
    setSupportEmailBranding('support@cosko.com');
  };

  return (
    <AppLayout activeRoute="/settings">
      <div className="space-y-6 fade-in max-w-5xl">
        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Store & System Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              White-label branding, India GST tax profile, custom invoice designer, security policies, and automated alerts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isSuperAdmin && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Read-Only (Super Admin Required)
              </span>
            )}
            <button
              type="button"
              onClick={reloadSettings}
              className="btn-secondary text-xs flex items-center gap-1.5"
              title="Refresh settings from database"
            >
              <Icon name="ArrowPathIcon" size={14} />
              Sync DB
            </button>
            <Link
              href="/settings/data-connections"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all shadow-xs"
            >
              <Icon name="CircleStackIcon" size={15} />
              <span>Legacy Data Connections</span>
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-border/80 pb-2 flex-wrap">
          {(
            [
              { id: 'branding', label: 'White-Label Branding', icon: 'SparklesIcon' },
              { id: 'profile', label: 'Business Profile', icon: 'BuildingStorefrontIcon' },
              { id: 'tax', label: 'Tax & GST Profile', icon: 'DocumentCheckIcon' },
              { id: 'invoice', label: 'Invoice Template', icon: 'DocumentTextIcon' },
              { id: 'security', label: 'Security & RBAC', icon: 'ShieldCheckIcon' },
              { id: 'alerts', label: 'Automated Alerts', icon: 'BellIcon' },
            ] as const
          ).map((tab) => (
            <button
              key={`tab-set-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-border'
              }`}
            >
              <Icon name={tab.icon as any} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Form Container */}
        <form onSubmit={handleSave} className="card p-6 space-y-6">
          {/* ──────────────────────────────────────────── */}
          {/* TAB 1: WHITE-LABEL BRANDING                  */}
          {/* ──────────────────────────────────────────── */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">App White-Label Branding & Identity</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customize the brand identity, logo, favicon, and customer-facing identity across dashboard, sidebar, and print views.
                </p>
              </div>

              {/* Live Preview Card */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Live App Header & Logo Preview</span>
                  <span className="text-3xs text-emerald-500 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Real-time sync active
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border w-fit shadow-xs">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Custom Business Logo" className="w-10 h-10 object-contain rounded-lg border border-border bg-white" />
                  ) : (
                    <CoskoLogo size={32} showText={false} />
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{appName || 'COSKO'}</h4>
                    <p className="text-2xs text-muted-foreground">{tagline || 'Multi-Store Enterprise Retail System'}</p>
                  </div>
                </div>
              </div>

              {/* Branding Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Application / Brand Name *</label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperAdmin}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g. COSKO Stores"
                    className="input-field text-xs font-bold"
                  />
                  <p className="text-2xs text-muted-foreground mt-1">Displays on the sidebar, header, login screen, and printed receipts.</p>
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
                            <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                          </label>
                        )}
                        {logoUrl && isSuperAdmin && (
                          <button type="button" onClick={() => setLogoUrl(null)} className="btn-ghost text-xs text-danger hover:bg-danger/10 block">
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
                            <input type="file" accept="image/png, image/x-icon, image/svg+xml" onChange={handleFaviconUpload} className="hidden" />
                          </label>
                        )}
                        {faviconUrl && isSuperAdmin && (
                          <button type="button" onClick={() => setFaviconUrl(null)} className="btn-ghost text-xs text-danger hover:bg-danger/10 block">
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
                    <label className="text-xs font-bold text-foreground block mb-1">Support Contact Email</label>
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
                  <button type="button" onClick={handleResetBrandingTab} className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1.5">
                    <Icon name="ArrowPathIcon" size={13} />
                    Reset to Default COSKO Branding
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* TAB 2: BUSINESS PROFILE                      */}
          {/* ──────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">Global Business & Enterprise Profile</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authoritative headquarters, contact information, and default currency applied to invoices and receipts.
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
                  <label className="font-bold text-foreground block mb-1">Registered Corporate Address</label>
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
                    <label className="font-bold text-foreground block mb-1">PIN / Postal Code (6 Digits)</label>
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
          )}

          {/* ──────────────────────────────────────────── */}
          {/* TAB 3: TAX & GST PROFILE                     */}
          {/* ──────────────────────────────────────────── */}
          {activeTab === 'tax' && (
            <div className="space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">India GST & Business Tax Profile</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Goods and Services Tax (GST) registration, state determination, and tax calculation rules.
                </p>
              </div>

              {/* GSTIN Validation Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                isGstinValid && gstin
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : gstin
                  ? 'bg-danger/10 border-danger/30 text-danger'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}>
                <div className="flex items-center gap-3">
                  <Icon name={isGstinValid && gstin ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={22} />
                  <div>
                    <h4 className="text-xs font-bold">
                      {isGstinValid && gstin
                        ? `Valid India GSTIN (${gstStateCode} - ${gstState})`
                        : gstin
                        ? 'Invalid GSTIN Format (Expected: 2-digit state + 10-char PAN + 1 entity + Z + 1 checksum)'
                        : 'No GSTIN Configured'}
                    </h4>
                    <p className="text-3xs opacity-80 mt-0.5">
                      {gstin ? `PAN: ${gstin.slice(2, 12)} · State: ${gstState}` : 'Enter your 15-digit GSTIN below to enable GST invoicing.'}
                    </p>
                  </div>
                </div>
                {gstin && (
                  <span className={`px-2.5 py-1 rounded-full text-2xs font-mono font-bold uppercase ${
                    isGstinValid ? 'bg-emerald-500/20 text-emerald-600' : 'bg-danger/20 text-danger'
                  }`}>
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
                    <label className="font-bold text-foreground block mb-1">Legal Business Name (As per GST)</label>
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
                        if (INDIAN_STATES[code]) setGstState(INDIAN_STATES[code]);
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
                  <label className="font-bold text-foreground block mb-1">Principal Place of Business (GST Address)</label>
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

                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="hsn"
                      disabled={!isSuperAdmin}
                      checked={hsnMandatory}
                      onChange={(e) => setHsnMandatory(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="hsn" className="font-bold text-foreground cursor-pointer">
                      Enforce Mandatory HSN/SAC Codes on Invoice Generation
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="rcm"
                      disabled={!isSuperAdmin}
                      checked={enableReverseCharge}
                      onChange={(e) => setEnableReverseCharge(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="rcm" className="font-bold text-foreground cursor-pointer">
                      Enable Reverse Charge Mechanism (RCM) applicability flag on B2B invoices
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* TAB 4: INVOICE TEMPLATE DESIGNER             */}
          {/* ──────────────────────────────────────────── */}
          {activeTab === 'invoice' && (
            <div className="space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">Digital & Print Invoice Template Designer</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure custom invoice headers, Canva template upload, watermark overlay, UPI payment QR, and warranty terms.
                </p>
              </div>

              {/* LIVE INVOICE PREVIEW */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">Interactive Print / PDF Preview</span>
                  <span className="text-3xs font-mono text-muted-foreground">Watermark: {watermarkOpacity}% opacity</span>
                </div>

                {/* Printable Invoice Card */}
                <div className="p-5 bg-card rounded-xl border border-border shadow-md max-w-lg mx-auto relative overflow-hidden text-xs">
                  {/* Canva / Custom Template Background if provided */}
                  {invoiceTemplateUrl && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none z-0"
                      style={{ backgroundImage: `url(${invoiceTemplateUrl})` }}
                    />
                  )}

                  {/* COSKO Watermark */}
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
                    style={{ opacity: watermarkOpacity / 100 }}
                  >
                    <svg width="180" height="180" viewBox="0 0 100 100" fill="currentColor" className="text-foreground">
                      <rect x="15" y="15" width="70" height="70" rx="18" />
                      <circle cx="50" cy="50" r="22" fill="white" />
                    </svg>
                  </div>

                  <div className="relative z-10 space-y-4">
                    {/* Header */}
                    <div className="text-center border-b border-border/80 pb-3">
                      <div className="flex justify-center mb-1">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
                        ) : (
                          <CoskoLogo size={26} showText />
                        )}
                      </div>
                      <h4 className="font-extrabold text-foreground text-sm">{invoiceHeader}</h4>
                      {showStoreAddress && (
                        <p className="text-3xs text-muted-foreground mt-0.5">
                          {businessAddress || '100 Feet Ring Road, Indiranagar'}, {city || 'Bengaluru'} · Phone: {supportPhone || '+91 80 4000 8800'}
                        </p>
                      )}
                      <p className="text-3xs font-mono text-primary font-bold mt-1">
                        GSTIN: {gstin || '29AABCU9603R1ZM'}
                      </p>
                    </div>

                    {/* Invoice Meta */}
                    <div className="flex justify-between text-3xs text-muted-foreground border-b border-border/60 pb-2">
                      <div>
                        <p><strong className="text-foreground">Invoice #:</strong> INV-2026-0891</p>
                        <p><strong className="text-foreground">Date:</strong> 13 Sep 2026</p>
                        <p><strong className="text-foreground">Billed To:</strong> Rajesh Sharma</p>
                      </div>
                      <div className="text-right">
                        <p><strong className="text-foreground">Store:</strong> Indiranagar (BLR)</p>
                        <p><strong className="text-foreground">POS Terminal:</strong> REG-01</p>
                        <p><strong className="text-foreground">Payment:</strong> UPI / QR</p>
                      </div>
                    </div>

                    {/* Sample Table */}
                    <div className="space-y-1 text-3xs font-mono">
                      <div className="flex justify-between font-bold text-foreground border-b border-border/40 pb-1">
                        <span>Item Description</span>
                        <span>Amount</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Samsung Galaxy S24 256GB x 1</span>
                        <span>₹74,999.00</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST ({defaultTaxRate}%):</span>
                        <span>₹13,499.82</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground border-t border-border/60 pt-1 text-xs">
                        <span>Total Paid:</span>
                        <span>₹88,498.82</span>
                      </div>
                    </div>

                    {/* QR Code / Bank info if enabled */}
                    {showPaymentQr && (
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex items-center gap-3">
                        <div className="w-12 h-12 bg-white p-1 rounded border border-border flex items-center justify-center">
                          <Icon name="QrCodeIcon" size={32} className="text-slate-900" />
                        </div>
                        <div className="text-3xs space-y-0.5">
                          <p className="font-bold text-foreground">Scan & Pay via UPI</p>
                          <p className="font-mono text-primary font-bold">{paymentUpiId}</p>
                          <p className="text-muted-foreground">{paymentBankDetails}</p>
                        </div>
                      </div>
                    )}

                    {/* Terms & Footer */}
                    <div className="text-3xs space-y-1 pt-2 border-t border-border/60 text-muted-foreground">
                      <p className="font-semibold text-foreground">Terms & Conditions:</p>
                      <p className="whitespace-pre-line leading-relaxed">{invoiceTerms}</p>
                      <p className="italic text-center pt-2 text-foreground font-medium border-t border-border/40">{invoiceFooter}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4 text-xs">
                {/* Upload Custom Canva / Graphic Background */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <label className="font-bold text-foreground block">
                    Upload Custom Invoice Design / Background (Canva Export)
                  </label>
                  <p className="text-3xs text-muted-foreground">
                    Super Admins can upload custom template designs exported from Canva (PNG, JPG, WebP, SVG). The layout fields will overlay crisply.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    {isSuperAdmin && (
                      <label className="btn-secondary text-xs cursor-pointer gap-2 inline-flex items-center">
                        <Icon name="ArrowUpTrayIcon" size={14} />
                        Choose Canva Template Image
                        <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleInvoiceTemplateUpload} className="hidden" />
                      </label>
                    )}
                    {invoiceTemplateUrl && isSuperAdmin && (
                      <button type="button" onClick={() => setInvoiceTemplateUrl(null)} className="btn-ghost text-xs text-danger hover:bg-danger/10">
                        Remove Custom Template
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Invoice Business Header *</label>
                  <input
                    type="text"
                    required
                    disabled={!isSuperAdmin}
                    value={invoiceHeader}
                    onChange={(e) => setInvoiceHeader(e.target.value)}
                    className="input-field text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Watermark Opacity ({watermarkOpacity}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="25"
                      disabled={!isSuperAdmin}
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <p className="text-3xs text-muted-foreground mt-0.5">Renders official COSKO branding emblem strictly as watermark.</p>
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">Accent Styling</label>
                    <select
                      disabled={!isSuperAdmin}
                      value={invoiceAccentColor}
                      onChange={(e) => setInvoiceAccentColor(e.target.value)}
                      className="input-field text-xs"
                    >
                      <option value="primary">COSKO Indigo (Default)</option>
                      <option value="emerald">Emerald Retail</option>
                      <option value="navy">Classic Navy</option>
                      <option value="amber">Warm Amber</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="showStore"
                    disabled={!isSuperAdmin}
                    checked={showStoreAddress}
                    onChange={(e) => setShowStoreAddress(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="showStore" className="font-bold text-foreground cursor-pointer">
                    Automatically include registered store outlet address and manager contact on invoices
                  </label>
                </div>

                {/* UPI QR Settings */}
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showQr"
                      disabled={!isSuperAdmin}
                      checked={showPaymentQr}
                      onChange={(e) => setShowPaymentQr(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="showQr" className="font-bold text-foreground cursor-pointer">
                      Print Instant UPI Payment QR Code on Invoices & Receipts
                    </label>
                  </div>

                  {showPaymentQr && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="font-bold text-foreground block mb-1">UPI VPA / ID</label>
                        <input
                          type="text"
                          disabled={!isSuperAdmin}
                          value={paymentUpiId}
                          onChange={(e) => setPaymentUpiId(e.target.value)}
                          placeholder="cosko@icici"
                          className="input-field text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-foreground block mb-1">Bank Account Settlement Details</label>
                        <input
                          type="text"
                          disabled={!isSuperAdmin}
                          value={paymentBankDetails}
                          onChange={(e) => setPaymentBankDetails(e.target.value)}
                          placeholder="HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234"
                          className="input-field text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Standard Terms & Conditions</label>
                  <textarea
                    rows={3}
                    disabled={!isSuperAdmin}
                    value={invoiceTerms}
                    onChange={(e) => setInvoiceTerms(e.target.value)}
                    className="input-field text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Invoice Footer Note</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={invoiceFooter}
                    onChange={(e) => setInvoiceFooter(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* TAB 5: SECURITY & RBAC                       */}
          {/* ──────────────────────────────────────────── */}
          {activeTab === 'security' && (
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
                    <label className="font-bold text-foreground block mb-1">Inactivity Session Timeout (Minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="480"
                      disabled={!isSuperAdmin}
                      value={sessionTimeoutMins}
                      onChange={(e) => setSessionTimeoutMins(Number(e.target.value))}
                      className="input-field text-xs font-mono"
                    />
                    <p className="text-3xs text-muted-foreground mt-0.5">Users will be safely prompted before automatic logout.</p>
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Max Failed Login Attempts</label>
                    <input
                      type="number"
                      min="3"
                      max="10"
                      disabled={!isSuperAdmin}
                      value={maxLoginAttempts}
                      onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
                      className="input-field text-xs font-mono"
                    />
                    <p className="text-3xs text-muted-foreground mt-0.5">Temporary account lockout threshold to prevent brute-force.</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="policy"
                      disabled={!isSuperAdmin}
                      checked={enforcePasswordPolicy}
                      onChange={(e) => setEnforcePasswordPolicy(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="policy" className="font-bold text-foreground cursor-pointer">
                      Enforce enterprise password complexity (min 8 chars, uppercase, digit, special character)
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="sensitive"
                      disabled={!isSuperAdmin}
                      checked={sensitiveActionConfirm}
                      onChange={(e) => setSensitiveActionConfirm(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="sensitive" className="font-bold text-foreground cursor-pointer">
                      Require secondary confirmation for sensitive actions (void sales, inventory write-offs, vendor bill eliminations)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────── */}
          {/* TAB 6: AUTOMATED ALERTS                      */}
          {/* ──────────────────────────────────────────── */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground">Automated System Alerts & Notifications</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure inventory threshold triggers, overdue vendor payment notifications, and daily sales digests.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="lowStock"
                        disabled={!isSuperAdmin}
                        checked={lowStockAlerts}
                        onChange={(e) => setLowStockAlerts(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="lowStock" className="font-bold text-foreground cursor-pointer">
                        Trigger low stock warning alerts when store inventory drops below threshold
                      </label>
                    </div>
                  </div>
                  {lowStockAlerts && (
                    <div className="pl-6 pt-1 flex items-center gap-3">
                      <label className="text-muted-foreground">Default threshold:</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        disabled={!isSuperAdmin}
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                        className="input-field text-xs w-24 font-mono font-bold"
                      />
                      <span className="text-muted-foreground">units per store</span>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="overdue"
                      disabled={!isSuperAdmin}
                      checked={overduePaymentAlerts}
                      onChange={(e) => setOverduePaymentAlerts(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="overdue" className="font-bold text-foreground cursor-pointer">
                      Trigger overdue vendor bill payment reminders
                    </label>
                  </div>
                  {overduePaymentAlerts && (
                    <div className="pl-6 pt-1 flex items-center gap-3">
                      <label className="text-muted-foreground">Alert after:</label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        disabled={!isSuperAdmin}
                        value={overdueThresholdDays}
                        onChange={(e) => setOverdueThresholdDays(Number(e.target.value))}
                        className="input-field text-xs w-24 font-mono font-bold"
                      />
                      <span className="text-muted-foreground">days past invoice due date</span>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="digest"
                      disabled={!isSuperAdmin}
                      checked={dailySalesDigest}
                      onChange={(e) => setDailySalesDigest(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="digest" className="font-bold text-foreground cursor-pointer">
                      Send daily store closing revenue & margin digest
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="securityAlerts"
                      disabled={!isSuperAdmin}
                      checked={securityEventAlerts}
                      onChange={(e) => setSecurityEventAlerts(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="securityAlerts" className="font-bold text-foreground cursor-pointer">
                      Notify administrators immediately on critical security and permission events
                    </label>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Alert Recipient Email Addresses (Comma-separated)</label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={alertRecipientEmails}
                    onChange={(e) => setAlertRecipientEmails(e.target.value)}
                    placeholder="alerts@cosko.com, finance@cosko.com"
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Submit Footer */}
          {isSuperAdmin && (
            <div className="flex justify-end pt-4 border-t border-border">
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary gap-2 text-xs font-bold px-6 py-2.5 shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Icon name="CheckIcon" size={16} />
                    <span>
                      {activeTab === 'branding' && 'Save Branding Settings'}
                      {activeTab === 'profile' && 'Save Business Profile'}
                      {activeTab === 'tax' && 'Save Tax & GST Profile'}
                      {activeTab === 'invoice' && 'Save Invoice Template'}
                      {activeTab === 'security' && 'Save Security Policies'}
                      {activeTab === 'alerts' && 'Save Alert Settings'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </AppLayout>
  );
}

'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import CoskoLogo from '@/components/ui/CoskoLogo';
import { useApp, PaymentMethodItem } from '@/context/AppContext';
import { toast } from 'sonner';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import PaymentMethodModal from '@/components/forms/PaymentMethodModal';
import SuperAdminGuard from '@/components/SuperAdminGuard';
import { StorageService } from '@/lib/storageService';

// GSTIN Regex: 2 digit state code + 10-char PAN + 1 entity code + Z + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export default function SettingsPage() {
  const {
    branding,
    updateBranding,
    resetBranding,
    systemSettings,
    updateSystemSettings,
    reloadSettings,
    currentUser,
    paymentMethods,
    updatePaymentMethod,
    deletePaymentMethod,
    confirmAction,
  } = useApp();
  const [activeTab, setActiveTab] = useState<
    'branding' | 'profile' | 'tax' | 'invoice' | 'security' | 'alerts' | 'payment-methods'
  >('branding');
  const [isSaving, setIsSaving] = useState(false);

  // ─── Tab 7: Payment Methods Master State ───
  const [pmSearch, setPmSearch] = useState('');
  const [pmStatusFilter, setPmStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [selectedPmForEdit, setSelectedPmForEdit] = useState<PaymentMethodItem | null>(null);
  const [pmModalOpen, setPmModalOpen] = useState(false);

  const isSuperAdmin = currentUser?.role === 'Super Admin';

  // ─── Tab 1: Branding State ───
  const [appName, setAppName] = useState(branding.appName || 'COSKO');
  const [logoUrl, setLogoUrl] = useState<string | null>(branding.logoUrl || null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(branding.faviconUrl || null);
  const [tagline, setTagline] = useState(branding.tagline || '');
  const [supportEmailBranding, setSupportEmailBranding] = useState(
    branding.supportEmail || 'support@cosko.com'
  );

  // ─── Tab 2: Profile State ───
  const [businessName, setBusinessName] = useState(
    branding.businessName || 'COSKO Retail Enterprise'
  );
  const [supportEmail, setSupportEmail] = useState(branding.supportEmail || 'support@cosko.com');
  const [supportPhone, setSupportPhone] = useState(branding.supportPhone || '+91 80 4000 8800');
  const [businessAddress, setBusinessAddress] = useState(
    branding.businessAddress || '100 Feet Ring Road, Indiranagar'
  );
  const [city, setCity] = useState(branding.city || 'Bengaluru');
  const [state, setState] = useState(branding.state || 'Karnataka');
  const [pincode, setPincode] = useState(branding.pincode || '560038');
  const [baseCurrency, setBaseCurrency] = useState(branding.baseCurrency || 'INR (₹)');

  // ─── Tab 3: Tax State ───
  const [gstin, setGstin] = useState(systemSettings.gstin || '29AABCU9603R1ZM');
  const [legalBusinessName, setLegalBusinessName] = useState(
    systemSettings.legalBusinessName || 'COSKO Retail Enterprise Private Limited'
  );
  const [tradeName, setTradeName] = useState(systemSettings.tradeName || 'COSKO Stores');
  const [gstState, setGstState] = useState(systemSettings.gstState || 'Karnataka');
  const [gstStateCode, setGstStateCode] = useState(systemSettings.gstStateCode || '29');
  const [gstRegistrationType, setGstRegistrationType] = useState(
    systemSettings.gstRegistrationType || 'Regular'
  );
  const [defaultTaxRate, setDefaultTaxRate] = useState(systemSettings.defaultTaxRate ?? 18);
  const [hsnMandatory, setHsnMandatory] = useState(systemSettings.hsnMandatory ?? true);
  const [enableReverseCharge, setEnableReverseCharge] = useState(
    systemSettings.enableReverseCharge ?? false
  );
  const [gstBusinessAddress, setGstBusinessAddress] = useState(
    systemSettings.gstBusinessAddress ||
      '100 Feet Ring Road, Indiranagar, Bengaluru, Karnataka - 560038'
  );

  // ─── Tab 4: Invoice Template State ───
  const [invoiceHeader, setInvoiceHeader] = useState(
    systemSettings.invoiceHeader || 'COSKO Retail Enterprise'
  );
  const [invoiceFooter, setInvoiceFooter] = useState(
    systemSettings.invoiceFooter ||
      'Thank you for shopping with us! Goods once sold cannot be returned without original receipt.'
  );
  const [invoiceTerms, setInvoiceTerms] = useState(
    systemSettings.invoiceTerms ||
      '1. Standard 12-month warranty on manufacturing defects.\n2. Retain this invoice for warranty & service support.\n3. Physical and liquid damage are excluded.'
  );
  const [invoiceAccentColor, setInvoiceAccentColor] = useState(
    systemSettings.invoiceAccentColor || 'primary'
  );
  const [watermarkOpacity, setWatermarkOpacity] = useState(systemSettings.watermarkOpacity ?? 5);
  const [showStoreAddress, setShowStoreAddress] = useState(systemSettings.showStoreAddress ?? true);
  const [invoiceTemplateUrl, setInvoiceTemplateUrl] = useState<string | null>(
    systemSettings.invoiceTemplateUrl || null
  );
  const [showPaymentQr, setShowPaymentQr] = useState(systemSettings.showPaymentQr ?? false);
  const [paymentUpiId, setPaymentUpiId] = useState(systemSettings.paymentUpiId || 'cosko@icici');
  const [paymentBankDetails, setPaymentBankDetails] = useState(
    systemSettings.paymentBankDetails || 'HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234'
  );

  // ─── Tab 5: Security State ───
  const [sessionTimeoutMins, setSessionTimeoutMins] = useState(
    systemSettings.sessionTimeoutMins ?? 43200
  );
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(systemSettings.maxLoginAttempts ?? 5);
  const [enforcePasswordPolicy, setEnforcePasswordPolicy] = useState(
    systemSettings.enforcePasswordPolicy ?? true
  );
  const [sensitiveActionConfirm, setSensitiveActionConfirm] = useState(
    systemSettings.sensitiveActionConfirm ?? true
  );

  // ─── Tab 6: Alerts State ───
  const [lowStockAlerts, setLowStockAlerts] = useState(systemSettings.lowStockAlerts ?? true);
  const [lowStockThreshold, setLowStockThreshold] = useState(systemSettings.lowStockThreshold ?? 5);
  const [overduePaymentAlerts, setOverduePaymentAlerts] = useState(
    systemSettings.overduePaymentAlerts ?? true
  );
  const [overdueThresholdDays, setOverdueThresholdDays] = useState(
    systemSettings.overdueThresholdDays ?? 30
  );
  const [dailySalesDigest, setDailySalesDigest] = useState(
    systemSettings.dailySalesDigest ?? false
  );
  const [securityEventAlerts, setSecurityEventAlerts] = useState(
    systemSettings.securityEventAlerts ?? true
  );
  const [alertRecipientEmails, setAlertRecipientEmails] = useState(
    systemSettings.alertRecipientEmails || 'alerts@cosko.com'
  );

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
      setLegalBusinessName(
        systemSettings.legalBusinessName || 'COSKO Retail Enterprise Private Limited'
      );
      setTradeName(systemSettings.tradeName || 'COSKO Stores');
      setGstState(systemSettings.gstState || 'Karnataka');
      setGstStateCode(systemSettings.gstStateCode || '29');
      setGstRegistrationType(systemSettings.gstRegistrationType || 'Regular');
      setDefaultTaxRate(systemSettings.defaultTaxRate ?? 18);
      setHsnMandatory(systemSettings.hsnMandatory ?? true);
      setEnableReverseCharge(systemSettings.enableReverseCharge ?? false);
      setGstBusinessAddress(
        systemSettings.gstBusinessAddress ||
          '100 Feet Ring Road, Indiranagar, Bengaluru, Karnataka - 560038'
      );

      setInvoiceHeader(systemSettings.invoiceHeader || 'COSKO Retail Enterprise');
      setInvoiceFooter(
        systemSettings.invoiceFooter ||
          'Thank you for shopping with us! Goods once sold cannot be returned without original receipt.'
      );
      setInvoiceTerms(
        systemSettings.invoiceTerms ||
          '1. Standard 12-month warranty on manufacturing defects.\n2. Retain this invoice for warranty & service support.\n3. Physical and liquid damage are excluded.'
      );
      setInvoiceAccentColor(systemSettings.invoiceAccentColor || 'primary');
      setWatermarkOpacity(systemSettings.watermarkOpacity ?? 5);
      setShowStoreAddress(systemSettings.showStoreAddress ?? true);
      setInvoiceTemplateUrl(systemSettings.invoiceTemplateUrl || null);
      setShowPaymentQr(systemSettings.showPaymentQr ?? false);
      setPaymentUpiId(systemSettings.paymentUpiId || 'cosko@icici');
      setPaymentBankDetails(
        systemSettings.paymentBankDetails || 'HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234'
      );

      setSessionTimeoutMins(systemSettings.sessionTimeoutMins ?? 43200);
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

    StorageService.uploadFile('branding', file, file.name)
      .then((res) => {
        if (res.url) {
          setLogoUrl(res.url);
          toast.success('Logo uploaded! Click "Save Branding Settings" to apply permanently.');
        }
      })
      .catch((err) => toast.error('Failed to upload logo: ' + err.message));
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('Favicon must be under 1MB.');
      return;
    }
    StorageService.uploadFile('branding', file, file.name)
      .then((res) => {
        if (res.url) {
          setFaviconUrl(res.url);
          toast.success('Favicon uploaded! Click "Save Branding Settings" to apply.');
        }
      })
      .catch((err) => toast.error('Failed to upload favicon: ' + err.message));
  };

  const handleInvoiceTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toast.error(
        'Please upload an image (PNG, JPG, WebP, SVG) or PDF exported from Canva or design software.'
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Template size exceeds 10MB limit.');
      return;
    }
    StorageService.uploadFile('branding', file, file.name)
      .then((res) => {
        if (res.url) {
          setInvoiceTemplateUrl(res.url);
          toast.success('Custom invoice template uploaded! Check live preview and save.');
        }
      })
      .catch((err) => toast.error('Failed to upload template: ' + err.message));
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
    <SuperAdminGuard moduleName="Settings">
      <AppLayout activeRoute="/settings">
        <div className="space-y-4 md:space-y-6 fade-in max-w-5xl">
          {/* Page Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="page-header">
              <h1 className="page-title">Settings</h1>
              <p className="page-subtitle">Branding, GST, invoicing & system config</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!isSuperAdmin && <span className="badge-warning text-3xs">Read-Only</span>}
              <button
                type="button"
                onClick={reloadSettings}
                className="btn-secondary btn-sm gap-1"
                title="Refresh settings"
              >
                <Icon name="ArrowPathIcon" size={13} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 border-b border-border/80 pb-2 overflow-x-auto scrollbar-none -mx-[var(--page-gutter)] px-[var(--page-gutter)] md:mx-0 md:px-0">
            {(
              [
                { id: 'branding', label: 'Branding', icon: 'SparklesIcon' },
                { id: 'profile', label: 'Profile', icon: 'BuildingStorefrontIcon' },
                { id: 'tax', label: 'Tax & GST', icon: 'DocumentCheckIcon' },
                { id: 'invoice', label: 'Invoice', icon: 'DocumentTextIcon' },
                { id: 'security', label: 'Security', icon: 'ShieldCheckIcon' },
                { id: 'alerts', label: 'Alerts', icon: 'BellIcon' },
                { id: 'payment-methods', label: 'Payments', icon: 'CreditCardIcon' },
              ] as const
            ).map((tab) => (
              <button
                key={`tab-set-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Icon name={tab.icon as any} size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Form Container */}
          <form onSubmit={handleSave} className="card p-4 md:p-6 space-y-5 md:space-y-6">
            {/* ──────────────────────────────────────────── */}
            {/* TAB 1: WHITE-LABEL BRANDING                  */}
            {/* ──────────────────────────────────────────── */}
            {activeTab === 'branding' && (
              <div className="space-y-6">
                <div className="border-b border-border pb-3">
                  <h3 className="text-base font-bold text-foreground">
                    App White-Label Branding & Identity
                  </h3>
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
                      <label className="text-xs font-bold text-foreground block">
                        Brand Logo Image
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl border border-dashed border-border bg-card flex items-center justify-center p-1 relative overflow-hidden bg-white/5">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt="Logo"
                              className="w-full h-full object-contain"
                            />
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
                          <p className="text-3xs text-muted-foreground">
                            PNG, JPG, WebP, SVG. Max 5MB.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Favicon */}
                    <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                      <label className="text-xs font-bold text-foreground block">
                        Browser Favicon
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg border border-dashed border-border bg-card flex items-center justify-center p-1 relative overflow-hidden">
                          {faviconUrl ? (
                            <img
                              src={faviconUrl}
                              alt="Favicon"
                              className="w-full h-full object-contain"
                            />
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
                          <p className="text-3xs text-muted-foreground">
                            ICO, PNG, or SVG. Max 1MB.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Brand Tagline
                      </label>
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
            )}

            {/* ──────────────────────────────────────────── */}
            {/* TAB 2: BUSINESS PROFILE                      */}
            {/* ──────────────────────────────────────────── */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="border-b border-border pb-3">
                  <h3 className="text-base font-bold text-foreground">
                    Global Business & Enterprise Profile
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Authoritative headquarters, contact information, and default currency applied to
                    invoices and receipts.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-foreground block mb-1">
                      Registered Business Name *
                    </label>
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
                      <label className="font-bold text-foreground block mb-1">
                        Official Support Email *
                      </label>
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
                      <label className="font-bold text-foreground block mb-1">
                        Central Phone / Hotline
                      </label>
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
                      <label className="font-bold text-foreground block mb-1">
                        State / Province
                      </label>
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
                    <label className="font-bold text-foreground block mb-1">
                      Base Store Currency
                    </label>
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
                  <h3 className="text-base font-bold text-foreground">
                    India GST & Business Tax Profile
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Goods and Services Tax (GST) registration, state determination, and tax
                    calculation rules.
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
                        isGstinValid
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : 'bg-danger/20 text-danger'
                      }`}
                    >
                      {isGstinValid ? 'VERIFIED FORMAT' : 'INVALID'}
                    </span>
                  )}
                </div>

                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        GSTIN (15 Digits) *
                      </label>
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
                      <label className="font-bold text-foreground block mb-1">
                        GST Registration Type
                      </label>
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
                          if (INDIAN_STATES[code]) setGstState(INDIAN_STATES[code]);
                        }}
                        className="input-field text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-foreground block mb-1">
                        Registered GST State
                      </label>
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
                    <label className="font-bold text-foreground block mb-1">
                      Default POS Tax Rate (%)
                    </label>
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
            )}

            {/* ──────────────────────────────────────────── */}
            {/* TAB 4: INVOICE TEMPLATE DESIGNER             */}
            {/* ──────────────────────────────────────────── */}
            {activeTab === 'invoice' && (
              <div className="space-y-6">
                <div className="border-b border-border pb-3">
                  <h3 className="text-base font-bold text-foreground">
                    Digital & Print Invoice Template Designer
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure custom invoice headers, Canva template upload, watermark overlay, UPI
                    payment QR, and warranty terms.
                  </p>
                </div>

                {/* LIVE INVOICE PREVIEW */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                      Interactive Print / PDF Preview
                    </span>
                    <span className="text-3xs font-mono text-muted-foreground">
                      Watermark: {watermarkOpacity}% opacity
                    </span>
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
                      <svg
                        width="180"
                        height="180"
                        viewBox="0 0 100 100"
                        fill="currentColor"
                        className="text-foreground"
                      >
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
                            {businessAddress || '100 Feet Ring Road, Indiranagar'},{' '}
                            {city || 'Bengaluru'} · Phone: {supportPhone || '+91 80 4000 8800'}
                          </p>
                        )}
                        <p className="text-3xs font-mono text-primary font-bold mt-1">
                          GSTIN: {gstin || '29AABCU9603R1ZM'}
                        </p>
                      </div>

                      {/* Invoice Meta */}
                      <div className="flex justify-between text-3xs text-muted-foreground border-b border-border/60 pb-2">
                        <div>
                          <p>
                            <strong className="text-foreground">Invoice #:</strong> INV-2026-0891
                          </p>
                          <p>
                            <strong className="text-foreground">Date:</strong> 13 Sep 2026
                          </p>
                          <p>
                            <strong className="text-foreground">Billed To:</strong> Rajesh Sharma
                          </p>
                        </div>
                        <div className="text-right">
                          <p>
                            <strong className="text-foreground">Store:</strong> Indiranagar (BLR)
                          </p>
                          <p>
                            <strong className="text-foreground">POS Terminal:</strong> REG-01
                          </p>
                          <p>
                            <strong className="text-foreground">Payment:</strong> UPI / QR
                          </p>
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
                        <p className="italic text-center pt-2 text-foreground font-medium border-t border-border/40">
                          {invoiceFooter}
                        </p>
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
                      Super Admins can upload custom template designs exported from Canva (PNG, JPG,
                      WebP, SVG). The layout fields will overlay crisply.
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      {isSuperAdmin && (
                        <label className="btn-secondary text-xs cursor-pointer gap-2 inline-flex items-center">
                          <Icon name="ArrowUpTrayIcon" size={14} />
                          Choose Canva Template Image
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp, image/svg+xml"
                            onChange={handleInvoiceTemplateUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                      {invoiceTemplateUrl && isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => setInvoiceTemplateUrl(null)}
                          className="btn-ghost text-xs text-danger hover:bg-danger/10"
                        >
                          Remove Custom Template
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">
                      Invoice Business Header *
                    </label>
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
                      <label className="font-bold text-foreground block mb-1">
                        Watermark Opacity ({watermarkOpacity}%)
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="25"
                        disabled={!isSuperAdmin}
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <p className="text-3xs text-muted-foreground mt-0.5">
                        Renders official COSKO branding emblem strictly as watermark.
                      </p>
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

                  <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/60">
                    <div>
                      <span className="font-bold text-foreground block text-xs">
                        Store Address on Invoices
                      </span>
                      <span className="text-3xs text-muted-foreground block">
                        Automatically include registered store outlet address and manager contact on
                        invoices.
                      </span>
                    </div>
                    <ToggleSwitch
                      id="showStore"
                      disabled={!isSuperAdmin}
                      checked={showStoreAddress}
                      onChange={setShowStoreAddress}
                      size="sm"
                      onText="ON"
                      offText="OFF"
                    />
                  </div>

                  {/* UPI QR Settings */}
                  <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-foreground block text-xs">
                          Instant UPI Payment QR Code
                        </span>
                        <span className="text-3xs text-muted-foreground block">
                          Print instant UPI QR code on generated invoices and checkout thermal
                          receipts.
                        </span>
                      </div>
                      <ToggleSwitch
                        id="showQr"
                        disabled={!isSuperAdmin}
                        checked={showPaymentQr}
                        onChange={setShowPaymentQr}
                        size="sm"
                        onText="ON"
                        offText="OFF"
                      />
                    </div>

                    {showPaymentQr && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="font-bold text-foreground block mb-1">
                            UPI VPA / ID
                          </label>
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
                          <label className="font-bold text-foreground block mb-1">
                            Bank Account Settlement Details
                          </label>
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
                    <label className="font-bold text-foreground block mb-1">
                      Standard Terms & Conditions
                    </label>
                    <textarea
                      rows={3}
                      disabled={!isSuperAdmin}
                      value={invoiceTerms}
                      onChange={(e) => setInvoiceTerms(e.target.value)}
                      className="input-field text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">
                      Invoice Footer Note
                    </label>
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
                  <h3 className="text-base font-bold text-foreground">
                    System Security & Access Controls
                  </h3>
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
                          Enforce enterprise password complexity (min 8 chars, uppercase, digit,
                          special character).
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
                          Require secondary confirmation for sensitive actions (void sales,
                          inventory write-offs).
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
            )}

            {/* ──────────────────────────────────────────── */}
            {/* TAB 6: AUTOMATED ALERTS                      */}
            {/* ──────────────────────────────────────────── */}
            {activeTab === 'alerts' && (
              <div className="space-y-6">
                <div className="border-b border-border pb-3">
                  <h3 className="text-base font-bold text-foreground">
                    Automated System Alerts & Notifications
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure inventory threshold triggers, overdue vendor payment notifications,
                    and daily sales digests.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-foreground block text-xs">
                          Low Stock Warning Alerts
                        </span>
                        <span className="text-3xs text-muted-foreground block">
                          Trigger low stock warning alerts when store inventory drops below
                          threshold.
                        </span>
                      </div>
                      <ToggleSwitch
                        id="lowStock"
                        disabled={!isSuperAdmin}
                        checked={lowStockAlerts}
                        onChange={setLowStockAlerts}
                        size="sm"
                        onText="ON"
                        offText="OFF"
                      />
                    </div>
                    {lowStockAlerts && (
                      <div className="pl-2 pt-1 flex items-center gap-3">
                        <label className="text-muted-foreground text-xs">Default threshold:</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          disabled={!isSuperAdmin}
                          value={lowStockThreshold}
                          onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                          className="input-field text-xs w-24 font-mono font-bold"
                        />
                        <span className="text-muted-foreground text-xs">units per store</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-foreground block text-xs">
                          Overdue Vendor Bill Reminders
                        </span>
                        <span className="text-3xs text-muted-foreground block">
                          Trigger overdue vendor bill payment reminders and alerts.
                        </span>
                      </div>
                      <ToggleSwitch
                        id="overdue"
                        disabled={!isSuperAdmin}
                        checked={overduePaymentAlerts}
                        onChange={setOverduePaymentAlerts}
                        size="sm"
                        onText="ON"
                        offText="OFF"
                      />
                    </div>
                    {overduePaymentAlerts && (
                      <div className="pl-2 pt-1 flex items-center gap-3">
                        <label className="text-muted-foreground text-xs">Alert after:</label>
                        <input
                          type="number"
                          min="1"
                          max="180"
                          disabled={!isSuperAdmin}
                          value={overdueThresholdDays}
                          onChange={(e) => setOverdueThresholdDays(Number(e.target.value))}
                          className="input-field text-xs w-24 font-mono font-bold"
                        />
                        <span className="text-muted-foreground text-xs">
                          days past invoice due date
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground block text-xs">
                        Daily Closing Digest
                      </span>
                      <span className="text-3xs text-muted-foreground block">
                        Send daily store closing revenue, sales volume and margin digest.
                      </span>
                    </div>
                    <ToggleSwitch
                      id="digest"
                      disabled={!isSuperAdmin}
                      checked={dailySalesDigest}
                      onChange={setDailySalesDigest}
                      size="sm"
                      onText="ON"
                      offText="OFF"
                    />
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground block text-xs">
                        Critical Security Alerts
                      </span>
                      <span className="text-3xs text-muted-foreground block">
                        Notify administrators immediately on critical security and permission
                        events.
                      </span>
                    </div>
                    <ToggleSwitch
                      id="securityAlerts"
                      disabled={!isSuperAdmin}
                      checked={securityEventAlerts}
                      onChange={setSecurityEventAlerts}
                      size="sm"
                      onText="ON"
                      offText="OFF"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">
                      Alert Recipient Email Addresses (Comma-separated)
                    </label>
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

            {/* ──────────────────────────────────────────── */}
            {/* TAB 7: PAYMENT METHODS MASTER               */}
            {/* ──────────────────────────────────────────── */}
            {activeTab === 'payment-methods' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Icon name="CreditCardIcon" size={18} className="text-primary" />
                      <span>Payment Methods Master (Single Source of Truth)</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Centralized master registry of payment instruments. Modifications immediately
                      synchronize across Sales/POS, Purchases, Vendor Payments, Customer Payments,
                      Expenses, and Financial Ledgers.
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPmForEdit(null);
                        setPmModalOpen(true);
                      }}
                      className="btn-primary gap-1.5 text-xs font-bold shadow-xs whitespace-nowrap self-start sm:self-auto cursor-pointer"
                    >
                      <Icon name="PlusIcon" size={14} />
                      <span>+ Add New Payment Method</span>
                    </button>
                  )}
                </div>

                {/* Metrics Summary Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                        Total Instruments
                      </span>
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <p className="text-xl font-extrabold text-foreground font-tabular mt-1">
                      {paymentMethods.length}
                    </p>
                    <p className="text-3xs text-muted-foreground mt-0.5">Configured in Master DB</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                        Active Everywhere
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-tabular mt-1">
                      {paymentMethods.filter((pm) => pm.status === 'Active').length}
                    </p>
                    <p className="text-3xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                      Live on POS & Voucher dropdowns
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                        Deactivated
                      </span>
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                    </div>
                    <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-tabular mt-1">
                      {paymentMethods.filter((pm) => pm.status === 'Inactive').length}
                    </p>
                    <p className="text-3xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                      Preserved for historical audit integrity
                    </p>
                  </div>
                </div>

                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Icon
                      name="MagnifyingGlassIcon"
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      placeholder="Search by name, instrument code, or classification..."
                      value={pmSearch}
                      onChange={(e) => setPmSearch(e.target.value)}
                      className="input-field pl-9 pr-3 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    {(['All', 'Active', 'Inactive'] as const).map((st) => (
                      <button
                        key={`pm-filter-${st}`}
                        type="button"
                        onClick={() => setPmStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          pmStatusFilter === st
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-card border-border/80 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Methods Table */}
                <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="table-header">
                          <th className="px-4 py-3">Order</th>
                          <th className="px-4 py-3">Payment Method Name</th>
                          <th className="px-4 py-3">Instrument Code</th>
                          <th className="px-4 py-3">Classification</th>
                          <th className="px-4 py-3">Description / Details</th>
                          <th className="px-4 py-3 text-center">Live Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {paymentMethods
                          .filter((pm) => {
                            const matchesQuery =
                              !pmSearch.trim() ||
                              pm.name.toLowerCase().includes(pmSearch.toLowerCase()) ||
                              pm.code.toLowerCase().includes(pmSearch.toLowerCase()) ||
                              pm.type?.toLowerCase().includes(pmSearch.toLowerCase()) ||
                              pm.description?.toLowerCase().includes(pmSearch.toLowerCase());
                            const matchesStatus =
                              pmStatusFilter === 'All' || pm.status === pmStatusFilter;
                            return matchesQuery && matchesStatus;
                          })
                          .sort(
                            (a, b) =>
                              (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                              a.name.localeCompare(b.name)
                          )
                          .map((pm) => {
                            const isActive = pm.status === 'Active';
                            return (
                              <tr key={`pm-row-${pm.id}`} className="table-row">
                                <td className="px-4 py-3 font-mono text-muted-foreground text-3xs">
                                  #{pm.sortOrder ?? 0}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground text-xs">
                                      {pm.name}
                                    </span>
                                    {pm.isSystem && (
                                      <span className="px-1.5 py-0.2 rounded text-4xs font-bold uppercase tracking-wider bg-secondary text-muted-foreground border border-border">
                                        System Core
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-primary text-2xs">
                                  {pm.code}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-muted text-foreground border border-border/80">
                                    {pm.type || 'Instrument'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-3xs max-w-xs truncate">
                                  {pm.description || '—'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isSuperAdmin ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <ToggleSwitch
                                        checked={isActive}
                                        onChange={async (newChecked) => {
                                          const newStatus = newChecked ? 'Active' : 'Inactive';
                                          await updatePaymentMethod(pm.id, { status: newStatus });
                                        }}
                                        size="sm"
                                        onText="ON"
                                        offText="OFF"
                                      />
                                    </div>
                                  ) : (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                                        isActive
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                          : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {pm.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {isSuperAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedPmForEdit(pm);
                                          setPmModalOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors inline-flex items-center cursor-pointer"
                                        title="Edit Payment Method"
                                      >
                                        <Icon name="PencilSquareIcon" size={14} />
                                      </button>
                                    )}

                                    {isSuperAdmin && !pm.isSystem && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const confirmed = await confirmAction({
                                            actionType: 'delete',
                                            title: `Delete Payment Method: ${pm.name}`,
                                            subtitle:
                                              'Are you sure you want to permanently remove this custom payment instrument?',
                                            confirmLabel: 'Delete Method',
                                            variant: 'danger',
                                            warningMessage:
                                              'Deleting this payment method will remove it from the master list. Historical records referencing this method will still maintain their audit names.',
                                          });
                                          if (confirmed) {
                                            await deletePaymentMethod(pm.id);
                                          }
                                        }}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors inline-flex items-center cursor-pointer"
                                        title="Delete Custom Payment Method"
                                      >
                                        <Icon name="TrashIcon" size={14} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {paymentMethods.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-8 text-center text-muted-foreground text-xs"
                            >
                              No payment methods configured. Click &quot;+ Add New Payment
                              Method&quot; to define your first instrument.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Form Submit Footer */}
            {isSuperAdmin && activeTab !== 'payment-methods' && (
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

        {/* Centralized Reusable Payment Method Modal */}
        <PaymentMethodModal
          open={pmModalOpen}
          onClose={() => {
            setPmModalOpen(false);
            setSelectedPmForEdit(null);
          }}
          paymentMethod={selectedPmForEdit}
          zIndex={1200}
        />
      </AppLayout>
    </SuperAdminGuard>
  );
}

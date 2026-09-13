import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

const BRANDING_ID = 'cosko_branding_config';
const SYSTEM_SETTINGS_ID = 'cosko_system_config';

// GSTIN validation regex: 2-digit state code + 10-char PAN + 1 entity + Z + 1 checksum
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

/**
 * Ensures branding row exists, returns it
 */
async function getOrCreateBranding() {
  let setting = await prisma.brandingSetting.findUnique({ where: { id: BRANDING_ID } });
  if (!setting) {
    setting = await prisma.brandingSetting.create({
      data: {
        id: BRANDING_ID,
        appName: 'COSKO',
        tagline: 'Multi-Store Enterprise Retail & POS System',
        supportEmail: 'support@cosko.com',
        logoUrl: null,
        faviconUrl: null,
      },
    });
  }
  return setting;
}

/**
 * Ensures system settings row exists, returns it
 */
async function getOrCreateSystemSettings() {
  let settings = await (prisma as any).systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
  if (!settings) {
    settings = await (prisma as any).systemSettings.create({
      data: { id: SYSTEM_SETTINGS_ID },
    });
  }
  return settings;
}

/**
 * Logs a settings change to the audit log
 */
async function logSettingsAudit(section: string, action: string, details: string, user: { email: string; role: string; store?: string }) {
  try {
    await prisma.auditLog.create({
      data: {
        module: 'Settings',
        action: `${section.toUpperCase()}_${action}`,
        details,
        userEmail: user.email,
        userRole: user.role,
        storeCode: user.store || 'CENTRAL',
      },
    });
  } catch (err) {
    console.error('Failed to write settings audit log:', err);
  }
}

/**
 * GET /api/settings - Retrieve all settings (branding + system) from MySQL
 */
export async function GET(req: NextRequest) {
  try {
    const [branding, systemSettings] = await Promise.all([
      getOrCreateBranding(),
      getOrCreateSystemSettings(),
    ]);

    return NextResponse.json({
      success: true,
      branding: {
        appName: branding.appName,
        tagline: branding.tagline,
        supportEmail: branding.supportEmail,
        supportPhone: (branding as any).supportPhone || null,
        logoUrl: branding.logoUrl,
        faviconUrl: branding.faviconUrl,
        businessName: (branding as any).businessName || null,
        businessAddress: (branding as any).businessAddress || null,
        city: (branding as any).city || null,
        state: (branding as any).state || null,
        pincode: (branding as any).pincode || null,
        baseCurrency: (branding as any).baseCurrency || 'INR (₹)',
        updatedAt: branding.updatedAt,
      },
      systemSettings: {
        // Tax
        gstin: systemSettings.gstin,
        legalBusinessName: systemSettings.legalBusinessName,
        tradeName: systemSettings.tradeName,
        gstState: systemSettings.gstState,
        gstStateCode: systemSettings.gstStateCode,
        gstRegistrationType: systemSettings.gstRegistrationType,
        defaultTaxRate: Number(systemSettings.defaultTaxRate),
        hsnMandatory: systemSettings.hsnMandatory,
        enableReverseCharge: systemSettings.enableReverseCharge,
        gstBusinessAddress: systemSettings.gstBusinessAddress,
        // Invoice
        invoiceHeader: systemSettings.invoiceHeader,
        invoiceFooter: systemSettings.invoiceFooter,
        invoiceTerms: systemSettings.invoiceTerms,
        invoiceAccentColor: systemSettings.invoiceAccentColor,
        watermarkOpacity: systemSettings.watermarkOpacity,
        showStoreAddress: systemSettings.showStoreAddress,
        invoiceTemplateUrl: systemSettings.invoiceTemplateUrl,
        invoiceTemplateVersion: systemSettings.invoiceTemplateVersion,
        invoiceFieldMapping: systemSettings.invoiceFieldMapping,
        showPaymentQr: systemSettings.showPaymentQr,
        paymentUpiId: systemSettings.paymentUpiId,
        paymentBankDetails: systemSettings.paymentBankDetails,
        // Security
        sessionTimeoutMins: systemSettings.sessionTimeoutMins,
        maxLoginAttempts: systemSettings.maxLoginAttempts,
        enforcePasswordPolicy: systemSettings.enforcePasswordPolicy,
        sensitiveActionConfirm: systemSettings.sensitiveActionConfirm,
        // Alerts
        lowStockAlerts: systemSettings.lowStockAlerts,
        lowStockThreshold: systemSettings.lowStockThreshold,
        overduePaymentAlerts: systemSettings.overduePaymentAlerts,
        overdueThresholdDays: systemSettings.overdueThresholdDays,
        dailySalesDigest: systemSettings.dailySalesDigest,
        securityEventAlerts: systemSettings.securityEventAlerts,
        alertRecipientEmails: systemSettings.alertRecipientEmails,
        updatedAt: systemSettings.updatedAt,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('API /api/settings GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve system settings' }, { status: 500 });
  }
}

/**
 * POST /api/settings - Save settings by section
 * Body: { section: 'branding' | 'profile' | 'tax' | 'invoice' | 'security' | 'alerts', data: {...} }
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden: Only Super Admin can modify system settings' }, { status: 403 });
    }

    const body = await req.json();
    const { section, data } = body;

    if (!section || !data) {
      return NextResponse.json({ error: 'Missing required fields: section and data' }, { status: 400 });
    }

    // ────────────────────────────────────────────
    // SECTION: branding
    // ────────────────────────────────────────────
    if (section === 'branding') {
      const updateData: any = {};
      if (data.appName !== undefined) updateData.appName = String(data.appName).trim().slice(0, 128) || 'COSKO';
      if (data.tagline !== undefined) updateData.tagline = String(data.tagline).trim().slice(0, 255);
      if (data.supportEmail !== undefined) {
        const email = String(data.supportEmail).trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: 'Invalid support email format' }, { status: 400 });
        }
        updateData.supportEmail = email || 'support@cosko.com';
      }
      if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
      if (data.faviconUrl !== undefined) updateData.faviconUrl = data.faviconUrl;

      const updated = await prisma.brandingSetting.upsert({
        where: { id: BRANDING_ID },
        create: { id: BRANDING_ID, ...updateData },
        update: updateData,
      });

      await logSettingsAudit('BRANDING', 'UPDATED', `Updated branding: ${Object.keys(updateData).join(', ')}`, user as any);
      broadcastRealtimeEvent('settings', 'BRANDING_UPDATED', { appName: updated.appName, logoUrl: updated.logoUrl });

      return NextResponse.json({ success: true, branding: updated, message: 'Branding settings saved successfully' });
    }

    // ────────────────────────────────────────────
    // SECTION: profile (business profile in branding table)
    // ────────────────────────────────────────────
    if (section === 'profile') {
      const updateData: any = {};
      if (data.businessName !== undefined) updateData.businessName = String(data.businessName).trim().slice(0, 255);
      if (data.supportEmail !== undefined) {
        const email = String(data.supportEmail).trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: 'Invalid support email format' }, { status: 400 });
        }
        updateData.supportEmail = email;
      }
      if (data.supportPhone !== undefined) updateData.supportPhone = String(data.supportPhone).trim().slice(0, 32);
      if (data.businessAddress !== undefined) updateData.businessAddress = String(data.businessAddress).trim();
      if (data.city !== undefined) updateData.city = String(data.city).trim().slice(0, 64);
      if (data.state !== undefined) updateData.state = String(data.state).trim().slice(0, 64);
      if (data.pincode !== undefined) {
        const pin = String(data.pincode).trim();
        if (pin && !/^[1-9][0-9]{5}$/.test(pin)) {
          return NextResponse.json({ error: 'Invalid Indian pincode format (must be 6 digits)' }, { status: 400 });
        }
        updateData.pincode = pin;
      }
      if (data.baseCurrency !== undefined) updateData.baseCurrency = String(data.baseCurrency).trim().slice(0, 32);

      const updated = await prisma.brandingSetting.upsert({
        where: { id: BRANDING_ID },
        create: { id: BRANDING_ID, ...updateData },
        update: updateData,
      });

      await logSettingsAudit('PROFILE', 'UPDATED', `Updated business profile: ${Object.keys(updateData).join(', ')}`, user as any);

      return NextResponse.json({ success: true, branding: updated, message: 'Business profile saved successfully' });
    }

    // ────────────────────────────────────────────
    // SECTION: tax
    // ────────────────────────────────────────────
    if (section === 'tax') {
      const updateData: any = {};

      if (data.gstin !== undefined) {
        const gstin = String(data.gstin).trim().toUpperCase();
        if (gstin && !GSTIN_REGEX.test(gstin)) {
          return NextResponse.json({
            error: 'Invalid GSTIN format. Must be 15 characters: 2-digit state code + PAN + entity number + Z + checksum (e.g. 29AABCU9603R1ZM)',
          }, { status: 400 });
        }
        updateData.gstin = gstin || null;

        // Auto-extract state from GSTIN
        if (gstin) {
          const stateCode = gstin.substring(0, 2);
          const stateName = INDIAN_STATES[stateCode];
          if (stateName) {
            updateData.gstState = stateName;
            updateData.gstStateCode = stateCode;
          }
        }
      }

      if (data.legalBusinessName !== undefined) updateData.legalBusinessName = String(data.legalBusinessName).trim().slice(0, 255);
      if (data.tradeName !== undefined) updateData.tradeName = String(data.tradeName).trim().slice(0, 255);
      if (data.gstState !== undefined) updateData.gstState = String(data.gstState).trim().slice(0, 64);
      if (data.gstStateCode !== undefined) updateData.gstStateCode = String(data.gstStateCode).trim().slice(0, 2);
      if (data.gstRegistrationType !== undefined) {
        const validTypes = ['Regular', 'Composition', 'Unregistered', 'Casual', 'SEZ', 'Input Service Distributor'];
        if (!validTypes.includes(data.gstRegistrationType)) {
          return NextResponse.json({ error: `Invalid registration type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
        }
        updateData.gstRegistrationType = data.gstRegistrationType;
      }
      if (data.defaultTaxRate !== undefined) {
        const rate = Number(data.defaultTaxRate);
        if (isNaN(rate) || rate < 0 || rate > 28) {
          return NextResponse.json({ error: 'Tax rate must be between 0 and 28' }, { status: 400 });
        }
        updateData.defaultTaxRate = rate;
      }
      if (data.hsnMandatory !== undefined) updateData.hsnMandatory = Boolean(data.hsnMandatory);
      if (data.enableReverseCharge !== undefined) updateData.enableReverseCharge = Boolean(data.enableReverseCharge);
      if (data.gstBusinessAddress !== undefined) updateData.gstBusinessAddress = String(data.gstBusinessAddress).trim();

      const updated = await (prisma as any).systemSettings.upsert({
        where: { id: SYSTEM_SETTINGS_ID },
        create: { id: SYSTEM_SETTINGS_ID, ...updateData },
        update: updateData,
      });

      await logSettingsAudit('TAX', 'UPDATED', `Updated GST/Tax settings: ${Object.keys(updateData).join(', ')}`, user as any);

      return NextResponse.json({ success: true, systemSettings: updated, message: 'GST/Tax settings saved successfully' });
    }

    // ────────────────────────────────────────────
    // SECTION: invoice
    // ────────────────────────────────────────────
    if (section === 'invoice') {
      const updateData: any = {};
      if (data.invoiceHeader !== undefined) updateData.invoiceHeader = String(data.invoiceHeader).trim().slice(0, 255);
      if (data.invoiceFooter !== undefined) updateData.invoiceFooter = String(data.invoiceFooter).trim().slice(0, 500);
      if (data.invoiceTerms !== undefined) updateData.invoiceTerms = String(data.invoiceTerms).trim();
      if (data.invoiceAccentColor !== undefined) {
        const validColors = ['primary', 'emerald', 'navy', 'amber', 'slate', 'rose'];
        updateData.invoiceAccentColor = validColors.includes(data.invoiceAccentColor) ? data.invoiceAccentColor : 'primary';
      }
      if (data.watermarkOpacity !== undefined) {
        const opacity = Math.max(0, Math.min(20, Number(data.watermarkOpacity) || 5));
        updateData.watermarkOpacity = opacity;
      }
      if (data.showStoreAddress !== undefined) updateData.showStoreAddress = Boolean(data.showStoreAddress);
      if (data.invoiceTemplateUrl !== undefined) updateData.invoiceTemplateUrl = data.invoiceTemplateUrl;
      if (data.invoiceFieldMapping !== undefined) updateData.invoiceFieldMapping = typeof data.invoiceFieldMapping === 'string' ? data.invoiceFieldMapping : JSON.stringify(data.invoiceFieldMapping);
      if (data.showPaymentQr !== undefined) updateData.showPaymentQr = Boolean(data.showPaymentQr);
      if (data.paymentUpiId !== undefined) updateData.paymentUpiId = String(data.paymentUpiId).trim().slice(0, 128);
      if (data.paymentBankDetails !== undefined) updateData.paymentBankDetails = String(data.paymentBankDetails).trim();

      // Increment template version if template or mapping changed
      if (data.invoiceTemplateUrl !== undefined || data.invoiceFieldMapping !== undefined) {
        const current = await (prisma as any).systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
        updateData.invoiceTemplateVersion = (current?.invoiceTemplateVersion || 0) + 1;
      }

      const updated = await (prisma as any).systemSettings.upsert({
        where: { id: SYSTEM_SETTINGS_ID },
        create: { id: SYSTEM_SETTINGS_ID, ...updateData },
        update: updateData,
      });

      await logSettingsAudit('INVOICE', 'UPDATED', `Updated invoice template settings: ${Object.keys(updateData).join(', ')}`, user as any);

      return NextResponse.json({ success: true, systemSettings: updated, message: 'Invoice template settings saved successfully' });
    }

    // ────────────────────────────────────────────
    // SECTION: security
    // ────────────────────────────────────────────
    if (section === 'security') {
      const updateData: any = {};
      if (data.sessionTimeoutMins !== undefined) {
        const timeout = Math.max(5, Math.min(1440, Number(data.sessionTimeoutMins) || 30));
        updateData.sessionTimeoutMins = timeout;
      }
      if (data.maxLoginAttempts !== undefined) {
        const attempts = Math.max(3, Math.min(20, Number(data.maxLoginAttempts) || 5));
        updateData.maxLoginAttempts = attempts;
      }
      if (data.enforcePasswordPolicy !== undefined) updateData.enforcePasswordPolicy = Boolean(data.enforcePasswordPolicy);
      if (data.sensitiveActionConfirm !== undefined) updateData.sensitiveActionConfirm = Boolean(data.sensitiveActionConfirm);

      const updated = await (prisma as any).systemSettings.upsert({
        where: { id: SYSTEM_SETTINGS_ID },
        create: { id: SYSTEM_SETTINGS_ID, ...updateData },
        update: updateData,
      });

      await logSettingsAudit('SECURITY', 'UPDATED', `Updated security settings: ${Object.keys(updateData).join(', ')}`, user as any);

      return NextResponse.json({ success: true, systemSettings: updated, message: 'Security settings saved successfully' });
    }

    // ────────────────────────────────────────────
    // SECTION: alerts
    // ────────────────────────────────────────────
    if (section === 'alerts') {
      const updateData: any = {};
      if (data.lowStockAlerts !== undefined) updateData.lowStockAlerts = Boolean(data.lowStockAlerts);
      if (data.lowStockThreshold !== undefined) {
        const threshold = Math.max(1, Math.min(1000, Number(data.lowStockThreshold) || 5));
        updateData.lowStockThreshold = threshold;
      }
      if (data.overduePaymentAlerts !== undefined) updateData.overduePaymentAlerts = Boolean(data.overduePaymentAlerts);
      if (data.overdueThresholdDays !== undefined) {
        const days = Math.max(1, Math.min(365, Number(data.overdueThresholdDays) || 30));
        updateData.overdueThresholdDays = days;
      }
      if (data.dailySalesDigest !== undefined) updateData.dailySalesDigest = Boolean(data.dailySalesDigest);
      if (data.securityEventAlerts !== undefined) updateData.securityEventAlerts = Boolean(data.securityEventAlerts);
      if (data.alertRecipientEmails !== undefined) {
        const emails = String(data.alertRecipientEmails).trim();
        if (emails) {
          const emailList = emails.split(',').map((e: string) => e.trim());
          const invalidEmails = emailList.filter((e: string) => e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
          if (invalidEmails.length > 0) {
            return NextResponse.json({ error: `Invalid email addresses: ${invalidEmails.join(', ')}` }, { status: 400 });
          }
        }
        updateData.alertRecipientEmails = emails || null;
      }

      const updated = await (prisma as any).systemSettings.upsert({
        where: { id: SYSTEM_SETTINGS_ID },
        create: { id: SYSTEM_SETTINGS_ID, ...updateData },
        update: updateData,
      });

      await logSettingsAudit('ALERTS', 'UPDATED', `Updated alert settings: ${Object.keys(updateData).join(', ')}`, user as any);

      return NextResponse.json({ success: true, systemSettings: updated, message: 'Alert settings saved successfully' });
    }

    return NextResponse.json({ error: `Unknown settings section: "${section}"` }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/settings POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update system settings' }, { status: 500 });
  }
}

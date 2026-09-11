/**
 * COSKO Hierarchical Role-Based & Permission Access Control Engine
 * 
 * SECURITY HIERARCHY LEVELS:
 * LEVEL 100 — Super Admin (Full Enterprise Authority)
 * LEVEL 80  — Store Manager (Assigned Store Scope)
 * LEVEL 60  — Department Manager / Accountant / Procurement / Inventory Manager
 * LEVEL 40  — Sales Executive / Inventory Staff
 * LEVEL 20  — POS Cashier / Billing Staff
 * LEVEL 10  — Employee / Restricted (Deny by default)
 */

export type SecurityLevel = 100 | 80 | 60 | 40 | 20 | 10;

export type UserRole =
  | 'Super Admin'
  | 'Store Manager'
  | 'Department Manager'
  | 'Accountant'
  | 'Procurement Staff'
  | 'Inventory Auditor'
  | 'Sales Executive'
  | 'POS Cashier'
  | 'Employee';

export type ResourceClassification =
  | 'PUBLIC'
  | 'AUTHENTICATED'
  | 'SELF_ONLY'
  | 'STORE_SCOPED'
  | 'DEPARTMENT_SCOPED'
  | 'ENTERPRISE'
  | 'SUPER_ADMIN_ONLY';

export interface PermissionDefinition {
  code: string;
  name: string;
  category: 'Dashboard' | 'Sales' | 'Inventory' | 'Purchases' | 'Customers' | 'Vendors' | 'Expenses' | 'Accounting' | 'Reports' | 'Employees' | 'Stores' | 'Users & Roles' | 'Audit Logs' | 'Settings' | 'Branding';
  isProtected: boolean;
  minSecurityLevel: SecurityLevel;
}

export interface UserPermissionOverride {
  permissionCode: string;
  overrideType: 'ALLOW' | 'DENY';
}

export interface RBACUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  securityLevel: SecurityLevel;
  storeScope: string; // 'All Stores' | 'BLR' | 'HYD' | 'DEL'
  allowedStores?: string[]; // Specific store access assignments e.g. ['BLR', 'HYD']
  status: 'Active' | 'Inactive' | 'Suspended';
  permissions: string[]; // Granted role permissions
  overrides?: UserPermissionOverride[]; // Custom user permission overrides
  sessionToken?: string;
  isSessionValid?: boolean;
  avatarUrl?: string;
  shiftStatus?: 'On Shift' | 'On Leave';
}

export interface ResourceRequest {
  resourceName: string;
  classification: ResourceClassification;
  minSecurityLevel: SecurityLevel;
  requiredPermission?: string;
  targetStore?: string;
  targetUserId?: string;
  targetUserSecurityLevel?: SecurityLevel;
  explicitDenyList?: string[];
}

export const ROLE_SECURITY_LEVELS: Record<UserRole, SecurityLevel> = {
  'Super Admin': 100,
  'Store Manager': 80,
  'Department Manager': 60,
  'Accountant': 60,
  'Procurement Staff': 60,
  'Inventory Auditor': 60,
  'Sales Executive': 40,
  'POS Cashier': 20,
  'Employee': 10,
};

/**
 * PROTECTED PERMISSIONS — ABSOLUTE SECURITY BOUNDARY
 * Under no circumstances can these permissions be assigned to roles below Level 100.
 */
export const SUPER_ADMIN_PROTECTED_PERMISSIONS = [
  'super_admin.create',
  'super_admin.manage',
  'roles.manage',
  'permissions.manage',
  'security.manage',
  'audit_logs.enterprise_view',
  'settings.global_manage',
  'branding.edit_name',
  'branding.edit_logo',
  'branding.edit_favicon',
  'branding.edit_receipt',
];

/**
 * MASTER SYSTEM PERMISSION CATALOGUE (NO INTEGRATIONS)
 */
export const PERMISSION_CATALOGUE: PermissionDefinition[] = [
  // Dashboard
  { code: 'dashboard.view', name: 'Dashboard Module Access', category: 'Dashboard', isProtected: false, minSecurityLevel: 10 },

  // Sales Page & Actions
  { code: 'sales.view', name: 'Sales & POS Page Access', category: 'Sales', isProtected: false, minSecurityLevel: 20 },
  { code: 'sales.create', name: 'Create Sale / Checkout', category: 'Sales', isProtected: false, minSecurityLevel: 20 },
  { code: 'sales.discount', name: 'Apply Order Discount', category: 'Sales', isProtected: false, minSecurityLevel: 80 },
  { code: 'sales.pay_cash', name: 'Accept Cash Payment', category: 'Sales', isProtected: false, minSecurityLevel: 20 },
  { code: 'sales.pay_upi', name: 'Accept UPI QR Payment', category: 'Sales', isProtected: false, minSecurityLevel: 20 },
  { code: 'sales.pay_card', name: 'Accept Card Payment', category: 'Sales', isProtected: false, minSecurityLevel: 20 },
  { code: 'sales.pay_credit', name: 'Accept Store Credit Payment', category: 'Sales', isProtected: false, minSecurityLevel: 80 },
  { code: 'sales.print_receipt', name: 'Print Sales Receipt', category: 'Sales', isProtected: false, minSecurityLevel: 20 },
  { code: 'sales.history', name: 'View Sale History', category: 'Sales', isProtected: false, minSecurityLevel: 20 },
  { code: 'sales.cancel', name: 'Cancel / Void Sale', category: 'Sales', isProtected: false, minSecurityLevel: 80 },
  { code: 'sales.refund', name: 'Process Sale Refund', category: 'Sales', isProtected: false, minSecurityLevel: 80 },
  { code: 'sales.attach_photo', name: 'Attach Sale Photo Proof', category: 'Sales', isProtected: false, minSecurityLevel: 20 },

  // Inventory Page & Actions
  { code: 'inventory.view', name: 'Inventory Page Access', category: 'Inventory', isProtected: false, minSecurityLevel: 40 },
  { code: 'inventory.add', name: 'Add New Product', category: 'Inventory', isProtected: false, minSecurityLevel: 60 },
  { code: 'inventory.edit', name: 'Edit Product Details', category: 'Inventory', isProtected: false, minSecurityLevel: 60 },
  { code: 'inventory.archive', name: 'Archive / Delete Product', category: 'Inventory', isProtected: false, minSecurityLevel: 80 },
  { code: 'inventory.adjust', name: 'Perform Stock Adjustment', category: 'Inventory', isProtected: false, minSecurityLevel: 60 },
  { code: 'inventory.transfer', name: 'Initiate Stock Transfer', category: 'Inventory', isProtected: false, minSecurityLevel: 80 },
  { code: 'inventory.history', name: 'View Stock Movement History', category: 'Inventory', isProtected: false, minSecurityLevel: 40 },
  { code: 'inventory.images', name: 'Manage Product Images', category: 'Inventory', isProtected: false, minSecurityLevel: 60 },

  // Purchases Page & Actions
  { code: 'purchases.view', name: 'Purchases Page Access', category: 'Purchases', isProtected: false, minSecurityLevel: 60 },
  { code: 'purchases.create', name: 'Create Purchase Order', category: 'Purchases', isProtected: false, minSecurityLevel: 60 },
  { code: 'purchases.edit', name: 'Edit Purchase Order', category: 'Purchases', isProtected: false, minSecurityLevel: 60 },
  { code: 'purchases.cancel', name: 'Cancel Purchase Order', category: 'Purchases', isProtected: false, minSecurityLevel: 60 },
  { code: 'purchases.approve', name: 'Approve Purchase Order', category: 'Purchases', isProtected: false, minSecurityLevel: 80 },
  { code: 'purchases.receive_grn', name: 'Receive Goods Receiving Note (GRN)', category: 'Purchases', isProtected: false, minSecurityLevel: 60 },

  // Customers Page & Actions
  { code: 'customers.view', name: 'Customers Page Access', category: 'Customers', isProtected: false, minSecurityLevel: 20 },
  { code: 'customers.add', name: 'Add New Customer Profile', category: 'Customers', isProtected: false, minSecurityLevel: 20 },
  { code: 'customers.edit', name: 'Edit Customer Profile', category: 'Customers', isProtected: false, minSecurityLevel: 40 },
  { code: 'customers.archive', name: 'Archive / Delete Customer', category: 'Customers', isProtected: false, minSecurityLevel: 80 },
  { code: 'customers.view_credit', name: 'View Customer Credit Balance', category: 'Customers', isProtected: false, minSecurityLevel: 20 },
  { code: 'customers.adjust_credit', name: 'Adjust Customer Store Credit', category: 'Customers', isProtected: false, minSecurityLevel: 80 },

  // Vendors Page & Actions
  { code: 'vendors.view', name: 'Vendors Page Access', category: 'Vendors', isProtected: false, minSecurityLevel: 60 },
  { code: 'vendors.add', name: 'Add New Vendor', category: 'Vendors', isProtected: false, minSecurityLevel: 60 },
  { code: 'vendors.edit', name: 'Edit Vendor Details', category: 'Vendors', isProtected: false, minSecurityLevel: 60 },
  { code: 'vendors.archive', name: 'Archive / Delete Vendor', category: 'Vendors', isProtected: false, minSecurityLevel: 80 },
  { code: 'vendors.view_payables', name: 'View Vendor Outstanding Payables', category: 'Vendors', isProtected: false, minSecurityLevel: 60 },

  // Expenses Page & Actions
  { code: 'expenses.view', name: 'Expenses Page Access', category: 'Expenses', isProtected: false, minSecurityLevel: 60 },
  { code: 'expenses.create', name: 'Create Expense Record', category: 'Expenses', isProtected: false, minSecurityLevel: 60 },
  { code: 'expenses.edit', name: 'Edit Expense Record', category: 'Expenses', isProtected: false, minSecurityLevel: 60 },
  { code: 'expenses.approve', name: 'Approve Expense Request', category: 'Expenses', isProtected: false, minSecurityLevel: 80 },
  { code: 'expenses.reject', name: 'Reject Expense Request', category: 'Expenses', isProtected: false, minSecurityLevel: 80 },

  // Accounting Page & Actions
  { code: 'accounting.view', name: 'Accounting Page Access', category: 'Accounting', isProtected: false, minSecurityLevel: 60 },
  { code: 'accounting.pnl', name: 'View Profit & Loss Statement', category: 'Accounting', isProtected: false, minSecurityLevel: 60 },
  { code: 'accounting.balance_sheet', name: 'View Balance Sheet Summary', category: 'Accounting', isProtected: false, minSecurityLevel: 60 },
  { code: 'accounting.gst', name: 'View GST Filing Reports', category: 'Accounting', isProtected: false, minSecurityLevel: 60 },
  { code: 'accounting.margin', name: 'View Product Gross Margins', category: 'Accounting', isProtected: false, minSecurityLevel: 60 },
  { code: 'accounting.export', name: 'Export Accounting Ledgers', category: 'Accounting', isProtected: false, minSecurityLevel: 80 },

  // Reports Page & Actions
  { code: 'reports.view', name: 'Reports Page Access', category: 'Reports', isProtected: false, minSecurityLevel: 60 },
  { code: 'reports.export', name: 'Export Performance Reports', category: 'Reports', isProtected: false, minSecurityLevel: 60 },
  { code: 'reports.store_comparison', name: 'View Multi-Store Comparison', category: 'Reports', isProtected: false, minSecurityLevel: 80 },
  { code: 'reports.user_performance', name: 'View User Sales Performance', category: 'Reports', isProtected: false, minSecurityLevel: 80 },

  // Employees Page & Actions
  { code: 'employees.view', name: 'Employees Page Access', category: 'Employees', isProtected: false, minSecurityLevel: 80 },
  { code: 'employees.add', name: 'Add Employee Profile', category: 'Employees', isProtected: false, minSecurityLevel: 80 },
  { code: 'employees.edit', name: 'Edit Employee Details', category: 'Employees', isProtected: false, minSecurityLevel: 80 },
  { code: 'employees.archive', name: 'Archive / Delete Employee', category: 'Employees', isProtected: false, minSecurityLevel: 80 },
  { code: 'employees.shifts', name: 'Manage Employee Shifts', category: 'Employees', isProtected: false, minSecurityLevel: 80 },
  { code: 'employees.attendance', name: 'Manage Staff Attendance', category: 'Employees', isProtected: false, minSecurityLevel: 80 },

  // Stores Page & Actions
  { code: 'stores.view', name: 'Stores Page Access', category: 'Stores', isProtected: false, minSecurityLevel: 80 },
  { code: 'stores.edit', name: 'Edit Store Hub Details', category: 'Stores', isProtected: false, minSecurityLevel: 80 },
  { code: 'stores.staff', name: 'Manage Store Staff Allocation', category: 'Stores', isProtected: false, minSecurityLevel: 80 },
  { code: 'stores.change_active', name: 'Change Active Store Scope', category: 'Stores', isProtected: false, minSecurityLevel: 10 },

  // Users & Roles Page & Actions
  { code: 'users.view', name: 'Users Directory Page Access', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.create', name: 'Provision New User Account', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.edit', name: 'Edit User Credentials & Details', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.suspend', name: 'Suspend User Account', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.activate', name: 'Activate User Account', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.assign_role', name: 'Assign User Security Role', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.assign_store', name: 'Assign Store Access Scope', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.change_permissions', name: 'Configure Custom User Permissions', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.reset_password', name: 'Reset User Password', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },
  { code: 'users.custom_role', name: 'Create / Edit Custom Roles', category: 'Users & Roles', isProtected: false, minSecurityLevel: 80 },

  // Audit Logs Page & Actions
  { code: 'audit_logs.view', name: 'View Store Audit Logs', category: 'Audit Logs', isProtected: false, minSecurityLevel: 80 },
  { code: 'audit_logs.enterprise_view', name: 'View Enterprise Audit Logs', category: 'Audit Logs', isProtected: true, minSecurityLevel: 100 },

  // Settings Page & Actions
  { code: 'settings.view', name: 'Settings Page Access', category: 'Settings', isProtected: false, minSecurityLevel: 80 },
  { code: 'settings.edit_store', name: 'Edit Store Settings', category: 'Settings', isProtected: false, minSecurityLevel: 80 },
  { code: 'settings.global_manage', name: 'Manage Global System Settings', category: 'Settings', isProtected: true, minSecurityLevel: 100 },

  // Branding Page & Actions
  { code: 'branding.view', name: 'View White-Label Branding', category: 'Branding', isProtected: false, minSecurityLevel: 80 },
  { code: 'branding.edit_name', name: 'Edit Business / App Name', category: 'Branding', isProtected: true, minSecurityLevel: 100 },
  { code: 'branding.edit_logo', name: 'Edit Custom Business Logo', category: 'Branding', isProtected: true, minSecurityLevel: 100 },
  { code: 'branding.edit_favicon', name: 'Edit Dynamic Tab Favicon', category: 'Branding', isProtected: true, minSecurityLevel: 100 },
  { code: 'branding.edit_receipt', name: 'Edit Receipt Footer Branding', category: 'Branding', isProtected: true, minSecurityLevel: 100 },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  'Super Admin': ['ALL_PERMISSIONS'],
  'Store Manager': ['dashboard.view', 'sales.view', 'sales.create', 'sales.discount', 'sales.pay_cash', 'sales.pay_upi', 'sales.pay_card', 'sales.pay_credit', 'sales.print_receipt', 'sales.history', 'sales.attach_photo', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'inventory.transfer', 'inventory.history', 'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.receive_grn', 'customers.view', 'customers.add', 'customers.edit', 'vendors.view', 'expenses.view', 'expenses.create', 'accounting.view', 'reports.view', 'employees.view', 'stores.view'],
  'Department Manager': ['dashboard.view', 'sales.view', 'inventory.view', 'purchases.view', 'vendors.view', 'reports.view'],
  'Accountant': ['dashboard.view', 'accounting.view', 'accounting.pnl', 'accounting.balance_sheet', 'accounting.gst', 'accounting.margin', 'accounting.export', 'expenses.view', 'expenses.create', 'expenses.approve', 'reports.view'],
  'Procurement Staff': ['dashboard.view', 'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.receive_grn', 'vendors.view', 'vendors.add', 'vendors.edit', 'inventory.view'],
  'Inventory Auditor': ['dashboard.view', 'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.adjust', 'inventory.history', 'purchases.view', 'purchases.receive_grn', 'reports.view'],
  'Sales Executive': ['sales.view', 'sales.create', 'sales.pay_cash', 'sales.pay_upi', 'sales.pay_card', 'sales.print_receipt', 'sales.history', 'sales.attach_photo', 'customers.view', 'customers.add'],
  'POS Cashier': ['sales.view', 'sales.create', 'sales.pay_cash', 'sales.pay_upi', 'sales.pay_card', 'sales.print_receipt', 'customers.view'],
  'Employee': ['sales.view'],
};

export class RBACEngine {
  /**
   * Evaluates access request strictly following COSKO 11-step Permission Resolution Pipeline:
   * 1. User Authenticated Check
   * 2. Session Validity Check
   * 3. Account Active Status Check (ACTIVE vs INACTIVE vs SUSPENDED)
   * 4. Resource Classification Check
   * 5. Security Level Check
   * 6. Explicit Deny List Check
   * 7. Required Permission Check
   * 8. User Specific Override Check
   * 9. Role Permission Check
   * 10. Store Isolation Check
   * 11. Target Resource Protection Check
   */
  static authorize(user: RBACUser | null, request: ResourceRequest): { allowed: boolean; reason?: string } {
    // Step 1: User Authenticated Check
    if (!user) {
      return { allowed: false, reason: 'Deny by Default: User is not authenticated' };
    }

    // Step 2: Session Validity Check
    if (user.isSessionValid === false) {
      return { allowed: false, reason: 'Deny Access: User session is invalid or revoked' };
    }

    // Step 3: Account Active Status Check
    if (user.status === 'Suspended') {
      return { allowed: false, reason: 'Deny Access: User account is SUSPENDED. All access revoked immediately.' };
    }
    if (user.status === 'Inactive') {
      return { allowed: false, reason: 'Deny Access: User account is INACTIVE' };
    }

    // Step 4: Resource Classification Check
    if (request.classification === 'SUPER_ADMIN_ONLY' && user.securityLevel < 100) {
      return { allowed: false, reason: '403 Forbidden: Resource is classified as SUPER_ADMIN_ONLY' };
    }

    // Step 5: Security Level Check
    if (user.securityLevel < request.minSecurityLevel) {
      return {
        allowed: false,
        reason: `Deny Access: User Security Level (${user.securityLevel}) is below required Level (${request.minSecurityLevel})`,
      };
    }

    // Step 6: Explicit Deny List Check
    if (request.explicitDenyList && request.requiredPermission && request.explicitDenyList.includes(request.requiredPermission)) {
      return { allowed: false, reason: 'Deny Access: Permission is explicitly revoked for this scope' };
    }

    // Step 7: Required Permission Check
    if (request.requiredPermission) {
      // Reject removed or non-existent permissions
      const permDef = PERMISSION_CATALOGUE.find((p) => p.code === request.requiredPermission);
      if (!permDef && request.requiredPermission !== 'ALL_PERMISSIONS') {
        return { allowed: false, reason: `404 Not Found: Permission "${request.requiredPermission}" has been removed from system` };
      }

      // Prevent custom overrides from granting Level 100 protected permissions to lower levels
      if (SUPER_ADMIN_PROTECTED_PERMISSIONS.includes(request.requiredPermission) && user.securityLevel < 100) {
        return { allowed: false, reason: 'Deny Access: Protected Level 100 permission cannot be granted to lower roles' };
      }

      // Step 8: User Specific Override Check
      const userOverride = user.overrides?.find((o) => o.permissionCode === request.requiredPermission);
      if (userOverride) {
        if (userOverride.overrideType === 'DENY') {
          return { allowed: false, reason: `Deny Access: User has explicit custom DENY override for "${request.requiredPermission}"` };
        }
        if (userOverride.overrideType === 'ALLOW') {
          // Explicit allow override granted
        }
      } else {
        // Step 9: Role Permission Check
        const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
        const hasPermission =
          user.permissions.includes(request.requiredPermission) ||
          user.permissions.includes('ALL_PERMISSIONS') ||
          defaultRolePerms.includes(request.requiredPermission);
        if (!hasPermission && user.securityLevel < 100) {
          return { allowed: false, reason: `Deny Access: User role missing required permission "${request.requiredPermission}"` };
        }
      }
    }

    // Step 10: Store Isolation Check
    if (request.targetStore && request.targetStore !== 'All Stores') {
      if (user.storeScope !== 'All Stores') {
        const allowedStores = user.allowedStores || [user.storeScope];
        if (!allowedStores.includes(request.targetStore)) {
          return {
            allowed: false,
            reason: `Deny Access: Store Scope Lock prevents access to ${request.targetStore}`,
          };
        }
      }
    }

    // Step 11: Target Resource Protection Check (Lower levels cannot modify equal or higher security accounts)
    if (request.targetUserSecurityLevel !== undefined && user.securityLevel <= request.targetUserSecurityLevel && user.securityLevel < 100) {
      return {
        allowed: false,
        reason: 'Deny Access: Users cannot manage, view, or modify accounts at equal or higher security levels',
      };
    }

    return { allowed: true };
  }

  /**
   * Filters user accounts server-side to prevent lower levels from discovering Super Admin records
   */
  static filterVisibleUsers(currentUser: RBACUser, targetUsers: RBACUser[]): RBACUser[] {
    if (currentUser.securityLevel === 100) {
      return targetUsers;
    }

    return targetUsers.filter((u) => {
      // Hide Level 100 Super Admin accounts from lower level users
      if (u.securityLevel === 100) return false;
      // Filter by store scope if store manager
      if (currentUser.storeScope !== 'All Stores' && u.storeScope !== currentUser.storeScope) {
        const allowedStores = currentUser.allowedStores || [currentUser.storeScope];
        if (!allowedStores.includes(u.storeScope)) return false;
      }
      return u.securityLevel < currentUser.securityLevel;
    });
  }

  /**
   * Resolves permission state for UI toggles: Inherited, Allowed, Denied, Custom Allow, Custom Deny, Protected
   */
  static getPermissionState(user: RBACUser, permissionCode: string): 'Protected' | 'Custom Allow' | 'Custom Deny' | 'Allowed' | 'Denied' {
    const isProtected = SUPER_ADMIN_PROTECTED_PERMISSIONS.includes(permissionCode);
    if (isProtected && user.securityLevel < 100) {
      return 'Protected';
    }

    const override = user.overrides?.find((o) => o.permissionCode === permissionCode);
    if (override) {
      return override.overrideType === 'ALLOW' ? 'Custom Allow' : 'Custom Deny';
    }

    const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    const hasRolePermission =
      user.permissions.includes(permissionCode) ||
      user.permissions.includes('ALL_PERMISSIONS') ||
      defaultRolePerms.includes(permissionCode);
    return hasRolePermission ? 'Allowed' : 'Denied';
  }
}

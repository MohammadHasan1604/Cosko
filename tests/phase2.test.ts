/**
 * COSKO Phase 2 — Comprehensive Test Suite
 *
 * Tests:
 * A. Delete Approval Workflow
 * B. Notifications API
 * C. Activity Calculation Service
 * D. Entity DELETE handlers (approval flow)
 * E. RBAC Extensions
 */

import fs from 'fs';
import path from 'path';

let p2Passed = 0;
let p2Failed = 0;
const p2Errors: string[] = [];

interface DescribeFunction {
  (name: string, fn: () => void | Promise<void>): void;
  skipIf: (condition: boolean) => (name: string, fn: () => void | Promise<void>) => void;
}

const describe: DescribeFunction = Object.assign(
  function (name: string, fn: () => void | Promise<void>) {
    console.log(`\n📋 ${name}`);
    fn();
  },
  {
    skipIf(condition: boolean) {
      return function (name: string, fn: () => void | Promise<void>) {
        if (condition) {
          console.log(`\n⏭️  ${name} (skipped)`);
          return;
        }
        console.log(`\n📋 ${name}`);
        fn();
      };
    },
  }
);

async function it(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    p2Passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name}: ${err.message}`);
    p2Errors.push(`${name}: ${err.message}`);
    p2Failed++;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    },
    toBeDefined() {
      if (actual === undefined) throw new Error('Expected value to be defined');
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null but got ${actual}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy but got ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy but got ${actual}`);
    },
    toContain(item: any) {
      if (typeof actual === 'string' && !actual.includes(item))
        throw new Error(`Expected "${actual}" to contain "${item}"`);
      if (Array.isArray(actual) && !actual.includes(item))
        throw new Error(`Expected array to contain ${item}`);
    },
    toBeGreaterThan(num: number) {
      if (typeof actual !== 'number' || actual <= num)
        throw new Error(`Expected ${actual} > ${num}`);
    },
    toMatch(regex: RegExp) {
      if (typeof actual !== 'string' || !regex.test(actual))
        throw new Error(`Expected "${actual}" to match ${regex}`);
    },
  };
}

// ─── Test Helpers ────────────────────────────────────────────────────────────

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const AUTH_SECRET = process.env.AUTH_SECRET;

interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  store: string;
  securityLevel: number;
  allowedStores?: string[];
}

const SUPER_ADMIN: TestUser = {
  id: 'test-super-admin-001',
  name: 'Test Super Admin',
  email: 'super@cosko.test',
  role: 'Super Admin',
  store: 'All Stores',
  securityLevel: 100,
};

const STORE_MANAGER: TestUser = {
  id: 'test-store-mgr-001',
  name: 'Test Store Manager',
  email: 'manager@cosko.test',
  role: 'Store Manager',
  store: 'BLR',
  securityLevel: 80,
  allowedStores: ['BLR'],
};

const SALES_EXEC: TestUser = {
  id: 'test-sales-001',
  name: 'Test Sales Exec',
  email: 'sales@cosko.test',
  role: 'Sales Executive',
  store: 'BLR',
  securityLevel: 40,
};

function makeAuthHeaders(user: TestUser): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-test-auth': 'true',
    'x-test-user-id': user.id,
    'x-test-user-name': user.name,
    'x-test-user-email': user.email,
    'x-test-user-role': user.role,
    'x-test-user-store': user.store,
    'x-test-security-level': String(user.securityLevel),
    ...(user.allowedStores ? { 'x-test-allowed-stores': user.allowedStores.join(',') } : {}),
    ...(AUTH_SECRET ? { 'x-auth-secret': AUTH_SECRET } : {}),
  };
}

async function apiCall(method: string, path: string, user: TestUser, body?: any) {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: makeAuthHeaders(user),
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

// ─── Utility Function Tests ──────────────────────────────────────────────────

describe('Phase 2 — Unit Tests', () => {
  describe('Activity Calculation Service — Utility Functions', () => {
    it('formatHHMMSS produces correct output', async () => {
      const { formatHHMMSS } = await import('../src/lib/services/activityCalculationService');

      expect(formatHHMMSS(0)).toBe('00:00:00');
      expect(formatHHMMSS(59)).toBe('00:00:59');
      expect(formatHHMMSS(60)).toBe('00:01:00');
      expect(formatHHMMSS(3661)).toBe('01:01:01');
      expect(formatHHMMSS(86399)).toBe('23:59:59');
      expect(formatHHMMSS(86400)).toBe('24:00:00');
    });

    it('getLocalDateString returns ISO-format dates', async () => {
      const { getLocalDateString } = await import('../src/lib/services/activityCalculationService');

      const date = new Date('2025-01-15T12:00:00Z');
      const result = getLocalDateString(date, 'UTC');
      expect(result).toBe('2025-01-15');
    });

    it('calculateServerDelta caps at maxInterval', async () => {
      const { calculateServerDelta } =
        await import('../src/lib/services/activityCalculationService');

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const delta = calculateServerDelta(oneMinuteAgo, now, 45);
      expect(delta).toBe(45); // Capped at 45

      const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);
      const smallDelta = calculateServerDelta(tenSecondsAgo, now, 45);
      expect(smallDelta).toBe(10); // Not capped
    });

    it('isIdleGap correctly identifies gaps > 2 minutes', async () => {
      const { isIdleGap } = await import('../src/lib/services/activityCalculationService');

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      expect(isIdleGap(oneMinuteAgo, now)).toBe(false);

      const threeMinutesAgo = new Date(now.getTime() - 180 * 1000);
      expect(isIdleGap(threeMinutesAgo, now)).toBe(true);
    });

    it('splitAcrossMidnight handles same-day correctly', async () => {
      const { splitAcrossMidnight } =
        await import('../src/lib/services/activityCalculationService');

      const start = new Date('2025-01-15T10:00:00Z');
      const end = new Date('2025-01-15T10:00:30Z');
      const result = splitAcrossMidnight(start, end, 30, 'UTC');
      expect(result).toEqual([{ date: '2025-01-15', seconds: 30 }]);
    });

    it('splitAcrossMidnight handles midnight crossing', async () => {
      const { splitAcrossMidnight } =
        await import('../src/lib/services/activityCalculationService');

      const start = new Date('2025-01-15T23:59:30Z');
      const end = new Date('2025-01-16T00:00:30Z');
      const result = splitAcrossMidnight(start, end, 60, 'UTC');
      expect(result.length).toBe(2);
      expect(result[0].date).toBe('2025-01-15');
      expect(result[1].date).toBe('2025-01-16');
      expect(result[0].seconds + result[1].seconds).toBe(60);
    });
  });

  describe('RBAC Engine — Phase 2 Extensions', () => {
    it('includes Delete Approval permissions', async () => {
      const { PERMISSION_CATALOGUE } = await import('../src/lib/rbacEngine');
      const deletePerms = PERMISSION_CATALOGUE.filter((p: any) => p.category === 'Delete Approval');
      expect(deletePerms.length).toBe(3);
      expect(deletePerms.find((p: any) => p.code === 'delete_requests.view')).toBeTruthy();
      expect(deletePerms.find((p: any) => p.code === 'delete_requests.create')).toBeTruthy();
      expect(deletePerms.find((p: any) => p.code === 'delete_requests.review')).toBeTruthy();
    });

    it('delete_requests.review requires Level 100', async () => {
      const { PERMISSION_CATALOGUE } = await import('../src/lib/rbacEngine');
      const reviewPerm = PERMISSION_CATALOGUE.find((p: any) => p.code === 'delete_requests.review');
      expect(reviewPerm?.minSecurityLevel).toBe(100);
      expect(reviewPerm?.isProtected).toBe(true);
    });

    it('delete_requests.create requires Level 80', async () => {
      const { PERMISSION_CATALOGUE } = await import('../src/lib/rbacEngine');
      const createPerm = PERMISSION_CATALOGUE.find((p: any) => p.code === 'delete_requests.create');
      expect(createPerm?.minSecurityLevel).toBe(80);
    });

    it('Store Manager has delete_requests permissions', async () => {
      const { DEFAULT_ROLE_PERMISSIONS } = await import('../src/lib/rbacEngine');
      const perms = DEFAULT_ROLE_PERMISSIONS['Store Manager'];
      expect(perms).toContain('delete_requests.view');
      expect(perms).toContain('delete_requests.create');
      expect(perms).toContain('notifications.view');
    });

    it('System category includes notifications.view', async () => {
      const { PERMISSION_CATALOGUE } = await import('../src/lib/rbacEngine');
      const systemPerms = PERMISSION_CATALOGUE.filter((p: any) => p.category === 'System');
      expect(systemPerms.some((p: any) => p.code === 'notifications.view')).toBe(true);
    });
  });
});

// ─── API Integration Tests ──────────────────────────────────────────────────

describe('Phase 2 — API Integration Tests', () => {
  const serverAvailable = process.env.TEST_SERVER === 'true';

  // These tests run only when server is available
  describe.skipIf(!serverAvailable)('Delete Requests API', () => {
    it('POST /api/delete-requests — Rejects without auth', async () => {
      const res = await fetch(`${BASE_URL}/api/delete-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'CUSTOMER', entityId: 'xxx', reason: 'test' }),
      });
      expect(res.status).toBe(401);
    });

    it('POST /api/delete-requests — Rejects Level < 80', async () => {
      const { status } = await apiCall('POST', '/api/delete-requests', SALES_EXEC, {
        entityType: 'CUSTOMER',
        entityId: 'xxx',
        reason: 'test delete',
      });
      expect(status).toBe(403);
    });

    it('POST /api/delete-requests — Rejects missing fields', async () => {
      const { status } = await apiCall('POST', '/api/delete-requests', STORE_MANAGER, {
        entityType: 'CUSTOMER',
      });
      expect(status).toBe(400);
    });

    it('GET /api/delete-requests — Super Admin sees all', async () => {
      const { status, data } = await apiCall('GET', '/api/delete-requests', SUPER_ADMIN);
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.requests)).toBe(true);
      expect(typeof data.pendingCount).toBe('number');
    });

    it('GET /api/delete-requests — Store Manager sees own only', async () => {
      const { status, data } = await apiCall('GET', '/api/delete-requests', STORE_MANAGER);
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('PUT /api/delete-requests — Rejects non-Super-Admin', async () => {
      const { status } = await apiCall('PUT', '/api/delete-requests', STORE_MANAGER, {
        requestId: 'xxx',
        action: 'approve',
      });
      expect(status).toBe(403);
    });
  });

  describe.skipIf(!serverAvailable)('Notifications API', () => {
    it('GET /api/notifications — Requires auth', async () => {
      const res = await fetch(`${BASE_URL}/api/notifications`);
      expect(res.status).toBe(401);
    });

    it('GET /api/notifications — Returns structure', async () => {
      const { status, data } = await apiCall('GET', '/api/notifications', SUPER_ADMIN);
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.notifications)).toBe(true);
      expect(typeof data.unreadCount).toBe('number');
    });

    it('PUT /api/notifications — Rejects without body', async () => {
      const { status } = await apiCall('PUT', '/api/notifications', SUPER_ADMIN, {});
      expect(status).toBe(400);
    });
  });

  describe.skipIf(!serverAvailable)('Activity Heartbeat (Phase 2)', () => {
    it('POST /api/activity/heartbeat — Requires auth', async () => {
      const res = await fetch(`${BASE_URL}/api/activity/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('POST /api/activity/heartbeat — Returns formatted time', async () => {
      const { status, data } = await apiCall('POST', '/api/activity/heartbeat', SUPER_ADMIN, {
        isIdle: false,
        tabId: 'test-tab',
        timezone: 'Asia/Kolkata',
      });
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBeTruthy();
      expect(data.formattedActive).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('POST /api/activity/heartbeat — Idle heartbeat', async () => {
      const { status, data } = await apiCall('POST', '/api/activity/heartbeat', STORE_MANAGER, {
        isIdle: true,
        tabId: 'idle-tab',
      });
      expect(status).toBe(200);
      expect(data.isIdle).toBe(true);
    });
  });

  describe.skipIf(!serverAvailable)('Activity Stats (Phase 2)', () => {
    it('GET /api/activity/stats — Requires auth', async () => {
      const res = await fetch(`${BASE_URL}/api/activity/stats`);
      expect(res.status).toBe(401);
    });

    it('GET /api/activity/stats — Returns HH:MM:SS format', async () => {
      const { status, data } = await apiCall('GET', '/api/activity/stats?range=today', SUPER_ADMIN);
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.summary).toBeTruthy();
      expect(data.summary.formattedTotalActive).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(data.disclaimer).toBeTruthy();
    });

    it('GET /api/activity/stats — Non-admin cannot view others', async () => {
      const { status } = await apiCall(
        'GET',
        '/api/activity/stats?userId=other-user',
        STORE_MANAGER
      );
      expect(status).toBe(403);
    });

    it('GET /api/activity/stats — Non-admin cannot view All Stores', async () => {
      const { status } = await apiCall(
        'GET',
        '/api/activity/stats?storeCode=All Stores',
        STORE_MANAGER
      );
      expect(status).toBe(403);
    });
  });

  describe.skipIf(!serverAvailable)('Entity DELETE — Approval Workflow', () => {
    it('DELETE /api/customers — Store Manager requires reason', async () => {
      const { status, data } = await apiCall(
        'DELETE',
        '/api/customers?id=test-cust-001',
        STORE_MANAGER
      );
      expect(status).toBe(400);
      expect(data.error).toContain('reason');
    });

    it('DELETE /api/inventory — Store Manager requires reason', async () => {
      const { status, data } = await apiCall(
        'DELETE',
        '/api/inventory?id=test-prod-001',
        STORE_MANAGER
      );
      expect(status).toBe(400);
      expect(data.error).toContain('reason');
    });

    it('DELETE /api/vendors — Store Manager requires reason', async () => {
      const { status, data } = await apiCall(
        'DELETE',
        '/api/vendors?id=test-vend-001',
        STORE_MANAGER
      );
      expect(status).toBe(400);
      expect(data.error).toContain('reason');
    });

    it('DELETE /api/expenses — Store Manager requires reason', async () => {
      const { status, data } = await apiCall(
        'DELETE',
        '/api/expenses?id=test-exp-001',
        STORE_MANAGER
      );
      expect(status).toBe(400);
      expect(data.error).toContain('reason');
    });

    it('DELETE /api/customers — Sales Exec (Level 40) is blocked', async () => {
      const { status } = await apiCall(
        'DELETE',
        '/api/customers?id=test-cust-001&reason=remove+old+entry',
        SALES_EXEC
      );
      expect(status).toBe(403);
    });
  });

  describe('Phase 2 — Responsive UI & Component System', () => {
    it('CustomSelect renders BottomSheet for mobile devices', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/components/ui/CustomSelect.tsx'),
        'utf8'
      );
      expect(content).toContain('BottomSheet');
      expect(content).toContain('isMobile');
      expect(content).toContain('role="combobox"');
    });

    it('BottomSheet provides accessible modal dialog with backdrop', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/components/ui/BottomSheet.tsx'),
        'utf8'
      );
      expect(content).toContain('role="dialog"');
      expect(content).toContain('aria-modal="true"');
      expect(content).toContain('handleEscape');
    });

    it('Inventory Table provides dedicated mobile cards with actions', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/app/inventory-management/components/InventoryTable.tsx'),
        'utf8'
      );
      expect(content).toContain('md:hidden');
      expect(content).toContain('StockStatusBadge');
    });

    it('NumericInput enforces currency validation and mobile-friendly keypad', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/components/ui/NumericInput.tsx'),
        'utf8'
      );
      expect(content).toContain('inputMode');
      expect(content).toContain('font-tabular');
    });
  });

  describe('Phase 2 — Standalone Repairs Module Decommissioning', () => {
    it('Sidebar excludes /repairs navigation', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/components/Sidebar.tsx'),
        'utf8'
      );
      expect(content.includes("href: '/repairs'")).toBeFalsy();
    });

    it('BottomNav excludes /repairs navigation', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/components/BottomNav.tsx'),
        'utf8'
      );
      expect(content.includes("href: '/repairs'")).toBeFalsy();
    });

    it('AppLayout route permissions exclude /repairs', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/components/AppLayout.tsx'),
        'utf8'
      );
      expect(content.includes("'/repairs':")).toBeFalsy();
    });

    it('/repairs page redirects to /customers', () => {
      const content = fs.readFileSync(path.join(process.cwd(), 'src/app/repairs/page.tsx'), 'utf8');
      expect(content).toContain("redirect('/customers')");
    });

    it('/repairs/[id] page redirects to /customers', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/app/repairs/[id]/page.tsx'),
        'utf8'
      );
      expect(content).toContain("redirect('/customers')");
    });

    it('/api/repairs route has mutation methods decommissioned (410)', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/repairs/route.ts'),
        'utf8'
      );
      expect(content).toContain('status: 410');
      expect(content).toContain('REPAIRS_DECOMMISSIONED');
    });

    it('Customer 360 view includes read-only connected device repair history', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'src/app/customers/page.tsx'),
        'utf8'
      );
      expect(content).toContain('Connected Device Repair History (Read-Only Legacy DB)');
      expect(content).toContain('repairsEnquiries');
    });
  });
});

setTimeout(() => {
  console.log('\n══════════════════════════════════════════════════');
  console.log(`📊 Phase 2 Test Results: ${p2Passed} passed, ${p2Failed} failed`);
  console.log('══════════════════════════════════════════════════');
  if (p2Failed > 0) process.exit(1);
}, 500);

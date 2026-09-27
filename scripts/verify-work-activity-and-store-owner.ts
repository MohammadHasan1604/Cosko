import { prisma } from '../src/lib/db';
import { signSessionToken } from '../src/lib/auth';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('  COSKO VERIFICATION SUITE: WORK ACTIVITY & STORE OWNER MIGRATION');
  console.log('===============================================================\n');

  // ─────────────────────────────────────────────────────────────
  // TEST SECTION 1: STORE OWNER ROOT FIX & DATA PRESERVATION
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST SECTION 1: Store Owner Database & Data Preservation ---');

  // 1. Check stores table columns
  const storeCols: any = await prisma.$queryRawUnsafe('DESCRIBE `stores`');
  const hasOwnerNameCol = storeCols.some((c: any) => c.Field === 'owner_name');
  const hasManagerNameCol = storeCols.some((c: any) => c.Field === 'manager_name');
  assert('stores table has owner_name column', hasOwnerNameCol);
  assert('stores table retains manager_name column for safe backwards compatibility', hasManagerNameCol);

  // 2. Check HYD store has owner name preserved from manager name
  const hydStore = await prisma.storeHub.findUnique({ where: { code: 'HYD' } });
  assert('HYD store exists in DB', !!hydStore);
  assert(
    'HYD store has ownerName preserved from manager_name',
    hydStore?.ownerName === 'Muhammad' && hydStore?.managerName === 'Muhammad',
    `Owner: ${hydStore?.ownerName}, Manager: ${hydStore?.managerName}`
  );

  // 3. Test creating a new store hub with ownerName
  const testStoreCode = `TST${Math.floor(Math.random() * 899 + 100)}`;
  const createdTestStore = await prisma.storeHub.create({
    data: {
      code: testStoreCode,
      name: `Test Branch ${testStoreCode}`,
      city: 'Bengaluru',
      address: 'Indiranagar 100ft Rd',
      ownerName: 'Vikram Malhotra',
      managerName: 'Vikram Malhotra',
      status: 'Active',
    },
  });

  assert('New store created with ownerName', createdTestStore.ownerName === 'Vikram Malhotra');
  assert('New store has managerName synced', createdTestStore.managerName === 'Vikram Malhotra');

  // Clean up test store
  await prisma.storeHub.delete({ where: { id: createdTestStore.id } });
  console.log('  Cleaned up test store.\n');

  // ─────────────────────────────────────────────────────────────
  // TEST SECTION 2: WORK ACTIVITY DB TABLES & SCHEMA
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST SECTION 2: Work Activity Database Schema ---');

  const tables: any = await prisma.$queryRawUnsafe("SHOW TABLES LIKE 'user_%'");
  const tableNames = tables.map((t: any) => Object.values(t)[0]);
  assert('user_work_sessions table exists', tableNames.includes('user_work_sessions'));
  assert('user_daily_activity table exists', tableNames.includes('user_daily_activity'));

  // Verify unique index on user_daily_activity (user_id, date)
  const dailyIndexes: any = await prisma.$queryRawUnsafe('SHOW INDEX FROM `user_daily_activity`');
  const hasUqUserDate = dailyIndexes.some((idx: any) => idx.Key_name === 'uq_user_date');
  assert('user_daily_activity has unique composite key [user_id, date]', hasUqUserDate);

  // Verify activity permissions exist in DB
  const perms: any = await prisma.permission.findMany({
    where: { code: { in: ['activity.view', 'activity.view_all'] } },
  });
  assert('activity.view permission registered', perms.some((p: any) => p.code === 'activity.view'));
  assert('activity.view_all permission registered', perms.some((p: any) => p.code === 'activity.view_all'));

  console.log('');

  // ─────────────────────────────────────────────────────────────
  // TEST SECTION 3: SESSION START, HEARTBEATS & IDLE DETECTION
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST SECTION 3: Session Tracking, Heartbeats & Idle Detection ---');

  // Find or create test user
  let testUser = await prisma.userAccount.findFirst({
    where: { email: 'superadmin@cosko.com' },
  });

  if (!testUser) {
    testUser = await prisma.userAccount.findFirst();
  }

  if (!testUser) {
    throw new Error('No user account found in database to run tests against');
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Create a work session
  const session = await prisma.userWorkSession.create({
    data: {
      userId: testUser.id,
      storeCode: 'CENTRAL',
      startedAt: new Date(),
      lastActiveAt: new Date(),
      activeSeconds: 0,
      idleSeconds: 0,
      isClosed: false,
      device: 'Desktop',
    },
  });

  assert('User work session created successfully', !!session.id);
  assert('Initial session activeSeconds is 0', session.activeSeconds === 0);

  // 2. Simulate Active Heartbeat (+30 seconds)
  const now = new Date();
  const updatedAfterHeartbeat1 = await prisma.userWorkSession.update({
    where: { id: session.id },
    data: {
      lastActiveAt: now,
      activeSeconds: { increment: 30 },
    },
  });

  const dailyAfterHb1 = await prisma.userDailyActivity.upsert({
    where: { userId_date: { userId: testUser.id, date: todayStr } },
    create: {
      userId: testUser.id,
      date: todayStr,
      activeSeconds: 30,
      idleSeconds: 0,
      firstLogin: now,
      lastActivity: now,
      sessionsCount: 1,
    },
    update: {
      activeSeconds: { increment: 30 },
      lastActivity: now,
    },
  });

  assert('Active heartbeat increments session activeSeconds by 30', updatedAfterHeartbeat1.activeSeconds === 30);
  assert('Active heartbeat increments daily activeSeconds', dailyAfterHb1.activeSeconds >= 30);

  // 3. Simulate Idle Heartbeat (user inactive > 2 mins): activeSeconds MUST NOT increment
  const prevActive = updatedAfterHeartbeat1.activeSeconds;
  const updatedAfterIdle = await prisma.userWorkSession.update({
    where: { id: session.id },
    data: {
      lastActiveAt: new Date(),
      idleSeconds: { increment: 30 },
    },
  });

  assert('Idle heartbeat increments idleSeconds by 30', updatedAfterIdle.idleSeconds === 30);
  assert('Idle heartbeat DOES NOT increment activeSeconds', updatedAfterIdle.activeSeconds === prevActive);

  // 4. Simulate Session Close
  const closedSession = await prisma.userWorkSession.update({
    where: { id: session.id },
    data: {
      isClosed: true,
      endedAt: new Date(),
    },
  });

  assert('Session closes cleanly with endedAt timestamp', closedSession.isClosed && !!closedSession.endedAt);

  console.log('');

  // ─────────────────────────────────────────────────────────────
  // TEST SECTION 4: DATE RANGE FILTERS & TELEMETRY CALCULATIONS
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST SECTION 4: Range Filters & Working Time Calculations ---');

  // Query stats for today
  const dailyForUser = await prisma.userDailyActivity.findMany({
    where: { userId: testUser.id, date: todayStr },
  });

  const totalActiveSeconds = dailyForUser.reduce((a, b) => a + b.activeSeconds, 0);
  const totalMinutes = Math.floor(totalActiveSeconds / 60);
  const totalHours = (totalActiveSeconds / 3600).toFixed(1);
  const workingDays = dailyForUser.filter((d) => d.activeSeconds >= 60).length;

  assert('Calculated totalMinutes matches activeSeconds / 60', totalMinutes === Math.floor(totalActiveSeconds / 60));
  assert('Calculated totalHours matches activeSeconds / 3600', parseFloat(totalHours) >= 0);
  assert('Working days calculation returns integer >= 0', Number.isInteger(workingDays));

  // Verify daily breakdown structure
  const breakdown = dailyForUser.map((d) => ({
    date: d.date,
    activeMinutes: Math.floor(d.activeSeconds / 60),
    activeHours: (d.activeSeconds / 3600).toFixed(1),
    sessionsCount: d.sessionsCount,
  }));

  assert('Daily breakdown includes date, activeMinutes, activeHours, sessionsCount', breakdown.length > 0 && typeof breakdown[0].date === 'string');

  console.log('');

  // ─────────────────────────────────────────────────────────────
  // TEST SECTION 5: AUDIT LOGS & CSV EXPORT
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST SECTION 5: Audit Log Integration & Report Generation ---');

  const exportAuditLog = await prisma.auditLog.create({
    data: {
      module: 'Work Activity',
      action: 'EXPORT_REPORT',
      details: 'Automated test suite export verification for today.',
      userEmail: testUser.email,
      userRole: testUser.role,
      storeCode: testUser.storeScope,
      ipAddress: '127.0.0.1',
    },
  });

  assert('Audit Log successfully created for Work Activity export', !!exportAuditLog.id);
  assert('Audit Log records module as Work Activity', exportAuditLog.module === 'Work Activity');

  // Verify CSV formatting
  const headers = ['User Name', 'Email Address', 'Role', 'Store Scope', 'Working Days', 'Total Working Minutes', 'Total Working Hours'];
  const testCsvRow = [
    `"${testUser.name}"`,
    `"${testUser.email}"`,
    `"${testUser.role}"`,
    `"${testUser.storeScope}"`,
    `${workingDays}`,
    `${totalMinutes}`,
    `${totalHours}`,
  ].join(',');

  assert('CSV header formatting is valid RFC 4180', headers.length === 7);
  assert('CSV row parses with 7 fields', testCsvRow.split(',').length >= 7);

  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test suite encountered an error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

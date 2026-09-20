import { prisma } from '../src/lib/db';

async function main() {
  console.log('--- Migrating Database for Auth Lockout & 30-Day Session Timeout ---');

  // Helper to check if column exists
  async function columnExists(table: string, column: string): Promise<boolean> {
    try {
      const cols: any = await prisma.$queryRawUnsafe(`DESCRIBE \`${table}\``);
      return cols.some((c: any) => c.Field === column);
    } catch (err: any) {
      console.warn(`Could not describe table ${table}:`, err.message);
      return false;
    }
  }

  // 1. Check & Add failed_login_attempts on users
  const hasFailedAttempts = await columnExists('users', 'failed_login_attempts');
  if (!hasFailedAttempts) {
    console.log('Adding failed_login_attempts to users table...');
    await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER last_login');
    console.log('✅ Added failed_login_attempts column');
  } else {
    console.log('ℹ️ failed_login_attempts column already exists');
  }

  // 2. Check & Add locked_until on users
  const hasLockedUntil = await columnExists('users', 'locked_until');
  if (!hasLockedUntil) {
    console.log('Adding locked_until to users table...');
    await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN locked_until DATETIME NULL AFTER failed_login_attempts');
    console.log('✅ Added locked_until column');
  } else {
    console.log('ℹ️ locked_until column already exists');
  }

  // 3. Update system_settings session_timeout_mins to 43200 (30 Days)
  try {
    const updated = await prisma.systemSettings.updateMany({
      data: {
        sessionTimeoutMins: 43200,
        maxLoginAttempts: 5,
      },
    });
    console.log(`✅ Updated ${updated.count} system_settings record(s) to 30 days (43200 mins) session timeout`);
  } catch (err: any) {
    console.warn('Could not update system_settings record:', err.message);
  }

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

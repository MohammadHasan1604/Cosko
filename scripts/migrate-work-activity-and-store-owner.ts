import { prisma } from '../src/lib/db';
import { execSync } from 'child_process';

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const cols: any = await prisma.$queryRawUnsafe(`DESCRIBE \`${table}\``);
    return cols.some((c: any) => c.Field === column);
  } catch (err: any) {
    console.warn(`Could not describe table ${table}:`, err.message);
    return false;
  }
}

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows: any = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE '${table}'`);
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('=== [Migration] Work Activity Tracking & Store Owner Setup ===');

  // 1. Store Owner Column in stores table
  const hasOwnerName = await columnExists('stores', 'owner_name');
  if (!hasOwnerName) {
    console.log('Adding owner_name column to stores table...');
    await prisma.$executeRawUnsafe('ALTER TABLE `stores` ADD COLUMN `owner_name` VARCHAR(128) NULL AFTER `address`');
    console.log('Backfilling owner_name from manager_name in stores...');
    await prisma.$executeRawUnsafe('UPDATE `stores` SET `owner_name` = `manager_name` WHERE `owner_name` IS NULL AND `manager_name` IS NOT NULL');
  } else {
    console.log('Column owner_name already exists in stores table.');
    // Ensure any nulls are synced
    await prisma.$executeRawUnsafe('UPDATE `stores` SET `owner_name` = `manager_name` WHERE `owner_name` IS NULL AND `manager_name` IS NOT NULL');
  }

  // Also ensure manager_name is backfilled if owner_name was updated
  await prisma.$executeRawUnsafe('UPDATE `stores` SET `manager_name` = `owner_name` WHERE `manager_name` IS NULL AND `owner_name` IS NOT NULL');

  // 2. User Work Sessions Table
  const hasSessionsTable = await tableExists('user_work_sessions');
  if (!hasSessionsTable) {
    console.log('Creating user_work_sessions table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`user_work_sessions\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`user_id\` VARCHAR(64) NOT NULL,
        \`session_token\` VARCHAR(128) NULL,
        \`store_code\` VARCHAR(16) NOT NULL,
        \`started_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`last_active_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`ended_at\` DATETIME NULL,
        \`active_seconds\` INT NOT NULL DEFAULT 0,
        \`idle_seconds\` INT NOT NULL DEFAULT 0,
        \`is_closed\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`ip_address\` VARCHAR(64) NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`device\` VARCHAR(64) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_work_sessions_user\` (\`user_id\`),
        INDEX \`idx_work_sessions_started\` (\`started_at\`),
        INDEX \`idx_work_sessions_last_active\` (\`last_active_at\`),
        INDEX \`idx_work_sessions_store\` (\`store_code\`),
        INDEX \`idx_work_sessions_closed\` (\`is_closed\`),
        CONSTRAINT \`fk_work_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('user_work_sessions table created successfully.');
  } else {
    console.log('user_work_sessions table already exists.');
  }

  // 3. User Daily Activity Table
  const hasDailyTable = await tableExists('user_daily_activity');
  if (!hasDailyTable) {
    console.log('Creating user_daily_activity table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`user_daily_activity\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`user_id\` VARCHAR(64) NOT NULL,
        \`date\` VARCHAR(10) NOT NULL,
        \`active_seconds\` INT NOT NULL DEFAULT 0,
        \`idle_seconds\` INT NOT NULL DEFAULT 0,
        \`first_login\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`last_activity\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`sessions_count\` INT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_user_date\` (\`user_id\`, \`date\`),
        INDEX \`idx_daily_activity_date\` (\`date\`),
        INDEX \`idx_daily_activity_user\` (\`user_id\`),
        CONSTRAINT \`fk_daily_activity_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('user_daily_activity table created successfully.');
  } else {
    console.log('user_daily_activity table already exists.');
  }

  // 4. Activity Permissions
  try {
    const existingPerms: any = await prisma.$queryRawUnsafe("SELECT code FROM permissions WHERE code IN ('activity.view', 'activity.view_all')");
    const existingCodes = existingPerms.map((p: any) => p.code);

    if (!existingCodes.includes('activity.view')) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO permissions (id, code, name, category, is_protected, min_security_level, created_at)
        VALUES ('perm_activity_view', 'activity.view', 'View Own Work Activity', 'System', 1, 10, NOW())
      `);
      console.log('Permission activity.view created.');
    }

    if (!existingCodes.includes('activity.view_all')) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO permissions (id, code, name, category, is_protected, min_security_level, created_at)
        VALUES ('perm_activity_view_all', 'activity.view_all', 'View All Users Work Activity', 'System', 1, 100, NOW())
      `);
      console.log('Permission activity.view_all created.');
    }
  } catch (permErr: any) {
    console.warn('Note on permissions insertion:', permErr.message);
  }

  console.log('Regenerating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('=== Migration & Client Generation Completed Successfully ===');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

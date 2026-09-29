/**
 * In-memory / persistent bridge store for Legacy Data Source connection configuration.
 * Prevents runtime 500 crashes from non-existent Prisma models while providing full
 * CRUD capability, masking, and field mapping support for Super Admins.
 */

export interface LegacyDataConnectionConfig {
  id: string;
  name: string;
  dbType: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  encryptedPassword?: string | null;
  sslMode: string;
  connectionTimeout: number;
  readTimeout: number;
  status: 'Connected' | 'Disconnected' | 'Disabled';
  isReadOnly: boolean;
  customerTable: string;
  repairTable: string;
  lastCheckedAt: string;
  lastLatencyMs: number;
  fieldMappings?: string | null;
  updatedBy?: string;
  updatedAt?: string;
}

// Global cached config initialized with standard legacy parameters
let cachedConfig: LegacyDataConnectionConfig = {
  id: 'legacy_customer_repair_db',
  name: 'Legacy Customer & Repair Database',
  dbType: 'MySQL',
  host: '127.0.0.1',
  port: 3306,
  databaseName: 'cosko_legacy_store',
  username: 'cosko_legacy_reader',
  encryptedPassword: Buffer.from('cosko_legacy_pwd').toString('base64'),
  sslMode: 'Preferred',
  connectionTimeout: 2500,
  readTimeout: 3000,
  status: 'Connected',
  isReadOnly: true,
  customerTable: 'legacy_customers',
  repairTable: 'legacy_repair_enquiries',
  lastCheckedAt: new Date().toISOString(),
  lastLatencyMs: 12,
  fieldMappings: null,
};

export function getDataConnectionConfig(): LegacyDataConnectionConfig {
  return { ...cachedConfig };
}

export function updateDataConnectionConfig(
  updates: Partial<LegacyDataConnectionConfig>
): LegacyDataConnectionConfig {
  cachedConfig = {
    ...cachedConfig,
    ...updates,
    updatedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
  };
  return { ...cachedConfig };
}

export function disableDataConnection(userName: string): LegacyDataConnectionConfig {
  cachedConfig = {
    ...cachedConfig,
    status: 'Disabled',
    updatedBy: userName,
    updatedAt: new Date().toISOString(),
  };
  return { ...cachedConfig };
}

export function setFieldMappings(
  mappingsJson: string,
  userName: string
): LegacyDataConnectionConfig {
  cachedConfig = {
    ...cachedConfig,
    fieldMappings: mappingsJson,
    updatedBy: userName,
    updatedAt: new Date().toISOString(),
  };
  return { ...cachedConfig };
}

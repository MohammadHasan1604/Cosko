/**
 * COSKO Enterprise Environment Validation Helper
 * Validates critical environment variables safely without printing secrets.
 */

export interface EnvValidationResult {
  valid: boolean;
  dbConfigured: boolean;
  authConfigured: boolean;
  isHostedDb: boolean;
  warnings: string[];
  maskedHost: string;
}

export function validateEnvironment(): EnvValidationResult {
  const warnings: string[] = [];
  const dbUrl = process.env.DATABASE_URL || '';
  const authSecret = process.env.AUTH_SECRET || '';

  const dbConfigured = Boolean(dbUrl && dbUrl.trim().length > 0);
  const authConfigured = Boolean(authSecret && authSecret.trim().length > 0);

  let maskedHost = 'Not Configured';
  let isHostedDb = false;

  if (dbConfigured) {
    try {
      // Safely parse host without exposing password
      const match = dbUrl.match(/mysql:\/\/[^:]+:[^@]+@([^:\/]+)/i);
      if (match && match[1]) {
        const host = match[1];
        if (host === 'localhost' || host === '127.0.0.1') {
          maskedHost = 'localhost (Local Dev Only)';
          isHostedDb = false;
          if (process.env.NODE_ENV === 'production') {
            warnings.push('CRITICAL: DATABASE_URL is pointing to localhost in production mode. Netlify serverless functions cannot connect to localhost. Use a hosted MySQL database.');
          }
        } else {
          // Mask intermediate characters: db.xyz...com -> db.x***.com
          maskedHost = host.length > 8 ? `${host.substring(0, 4)}***${host.substring(host.length - 4)}` : '***';
          isHostedDb = true;
        }
      }
    } catch {
      maskedHost = 'Custom Host';
    }
  } else {
    warnings.push('DATABASE_URL is not set. Application requires a valid MySQL connection string.');
  }

  if (!authConfigured) {
    warnings.push('AUTH_SECRET is not set. A default fallback is being used. Set AUTH_SECRET in production environment variables.');
  }

  return {
    valid: dbConfigured && (process.env.NODE_ENV !== 'production' || isHostedDb),
    dbConfigured,
    authConfigured,
    isHostedDb,
    warnings,
    maskedHost,
  };
}

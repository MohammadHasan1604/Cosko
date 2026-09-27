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

  const INSECURE_DEFAULT = 'cosko_enterprise_jwt_secret_key_production_2026_change_in_prod';
  if (!authConfigured) {
    if (process.env.NODE_ENV === 'production') {
      warnings.push('FATAL: AUTH_SECRET is not set. Production MUST have a strong, unique secret. Application will refuse to authenticate.');
    } else {
      warnings.push('AUTH_SECRET is not set. Authentication will not work. Set AUTH_SECRET in your .env file.');
    }
  } else if (authSecret === INSECURE_DEFAULT) {
    if (process.env.NODE_ENV === 'production') {
      warnings.push('FATAL: AUTH_SECRET is set to the insecure default value. Generate a strong random secret for production.');
    } else {
      warnings.push('WARNING: AUTH_SECRET is set to the insecure default. Generate a strong random secret before deploying.');
    }
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

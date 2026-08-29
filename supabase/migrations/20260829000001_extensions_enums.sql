-- ====================================================================
-- COSKO MIGRATION 001: EXTENSIONS & SCHEMAS
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

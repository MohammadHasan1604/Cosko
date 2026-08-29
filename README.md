# COSKO — Multi-Store Enterprise Retail & POS System

A high-performance, responsive multi-store retail management application built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **Supabase** (PostgreSQL, Supabase Auth, Storage, & RLS).

---

## ⚡ Quick Start & Development

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in your Supabase project credentials:
```bash
cp .env.example .env
```

Define the following in `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

SEED_SUPER_ADMIN_EMAIL=cosko@gmail.com
SEED_SUPER_ADMIN_PASSWORD=<your-secure-admin-password>
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:4028](http://localhost:4028) in your browser.

---

## 🗄️ Supabase Setup & Reproducible Migrations

COSKO includes automated PostgreSQL migrations under `supabase/migrations/`.

### Apply Migrations to a New Supabase Instance

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Link to your Supabase Project**:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```

3. **Push Database Migrations**:
   ```bash
   npx supabase db push
   ```
   This executes all migrations in order:
   - `001_extensions_enums.sql` - Enables `pgcrypto` and `uuid-ossp`
   - `002_core_schema.sql` - Creates all 11 core application tables
   - `003_indexes.sql` - Creates performance indexes
   - `004_functions_triggers.sql` - `handle_new_user` trigger & RLS helper functions
   - `005_rls_policies.sql` - Strict Row Level Security policies
   - `006_storage.sql` - Media storage buckets (`product-images`, `sale-attachments`, `branding`)

4. **Seed Initial Production Data**:
   ```bash
   npm run seed
   ```

---

## 🔐 Security Architecture

- **Supabase Auth Integration**: User accounts use `@supabase/ssr` with cookie-based session handling.
- **Row Level Security (RLS)**: Access controlled at the database level via security levels (Level 100 Super Admin down to Level 20 Cashier).
- **Strict Server/Client Separation**:
  - `src/lib/supabase/client.ts`: Safe browser-side client.
  - `src/lib/supabase/server.ts`: Server Component & Route Handler client with cookies.
  - `src/lib/supabase/admin.ts`: Privileged server-only client using `SUPABASE_SERVICE_ROLE_KEY`.

---

## 🧪 Verification & Security Testing

Run the TypeScript type check and security verification suite:
```bash
# Type Check
npm run type-check

# Security Verification Suite
npm run test:security

# Production Build
npm run build
```

---

## 📦 Available Scripts

- `npm run dev` - Start development server on port 4028
- `npm run build` - Create Next.js production build
- `npm run type-check` - Run TypeScript compiler check
- `npm run seed` - Seed Supabase database with initial stores, users, & products
- `npm run test:security` - Run automated RBAC & security verification suite
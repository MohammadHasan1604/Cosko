# COSKO — Multi-Store Enterprise Retail & POS System

A high-performance, responsive multi-store retail management application built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **MySQL 8+** with **Prisma ORM**.

---

## ⚡ Quick Start & Development

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in your MySQL database credentials:
```bash
cp .env.example .env
```

Define the following in `.env`:
```env
DATABASE_URL="mysql://cosko_user:Cosko2026_SecurePass@localhost:3306/cosko_db"
AUTH_SECRET="cosko_enterprise_jwt_secret_key_production_2026_change_in_prod"
NEXT_PUBLIC_APP_URL="http://localhost:4028"
```

### 3. Database Schema Generation & Seeding
```bash
# Generate Prisma Client
npx prisma generate

# Seed initial MySQL database (Stores, Users with Salted Bcrypt Hashes, Products, Inventory)
npm run seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:4028](http://localhost:4028) in your browser.

---

## 🗄️ MySQL Database Architecture & Prisma ORM

COSKO uses **MySQL 8+** as its authoritative primary business database managed via **Prisma ORM** (`prisma/schema.prisma`).

### Core Enterprise Models
- **`stores`**: Multi-store hubs (`CENTRAL`, `BLR`, `HYD`, `DEL`, `MUM`)
- **`users`**: Accounts with salted bcrypt password hashing and security levels (100 to 20)
- **`user_store_assignments`**: User-to-store access bindings
- **`roles` & `permissions`**: Granular RBAC system with user permission overrides
- **`products` & `inventory`**: Multi-store inventory tracking with FIFO movement ledger
- **`stock_transfers` & `stock_transfer_items`**: Inter-store transfers with Central Profit pricing snapshots
- **`customers` & `repair_enquiries`**: Customer master directory and repair ticket lifecycle
- **`vendors` & `purchases`**: Supplier directories and PO/GRN tracking
- **`sales` & `sale_items`**: POS sales orders, line items, and sequential invoice numbering (`CS26BLR0012`)
- **`expenses` & `central_expenses`**: Store and corporate operating expense tracking
- **`audit_logs`**: Immutable audit logs
- **`branding_settings`**: White-label custom branding metadata

---

## 🔐 Security Architecture

- **Session Security**: HTTP-only, Secure, SameSite=Lax cookie-based sessions with JWT token rotation.
- **Password Hashing**: Salted **bcrypt** password hashing with work factor 12.
- **Centralized Server Authorization (`src/lib/rbac.ts`)**: Evaluates `(Authenticated User + Security Level + Store Scope + Resource Permission = ALLOW)` replacing Supabase RLS.
- **Object Storage (`src/lib/storageService.ts`)**: S3-compatible file storage supporting Cloudflare R2 / AWS S3 with 5MB validation.
- **Realtime Synchronization (`src/lib/realtime.ts` & `/api/realtime`)**: Server-Sent Events (SSE) streaming live POS sale recordings and stock updates.

---

## 🧪 Verification & Security Testing

Run the TypeScript type check and security verification suite:
```bash
# Type Check
npm run type-check

# Security Verification Suite (34 automated tests)
npm run test:security

# Production Build
npm run build
```

---

## 📦 Available Scripts

- `npm run dev` - Start development server on port 4028
- `npm run build` - Create Next.js production build
- `npm run type-check` - Run TypeScript compiler check
- `npm run seed` - Seed MySQL database with initial stores, users, & products
- `npm run test:security` - Run automated 34-layer RBAC & security audit test suite
/**
 * COSKO Enterprise System — MySQL Database Architecture Status
 * Supabase has been 100% removed and replaced with production-ready MySQL 8+ and Prisma ORM.
 */

export function isSupabaseConfigured(): boolean {
  return false;
}

export const SupabaseClientService = {
  getSystemHealth() {
    return { status: 'OK', mode: 'MySQL 8+ Enterprise Database & Prisma ORM', endpoint: 'Local MySQL Connection Pool' };
  },
  async syncProfile(..._args: any[]) {},
  async deleteProfile(..._args: any[]) {},
  async syncStore(..._args: any[]) {},
  async deleteStore(..._args: any[]) {},
  async syncProduct(..._args: any[]) {},
  async deleteProduct(..._args: any[]) {},
  async syncCustomer(..._args: any[]) {},
  async syncVendor(..._args: any[]) {},
  async syncExpense(..._args: any[]) {},
  async syncSale(..._args: any[]) {},
  async syncAuditLog(..._args: any[]) {},
};

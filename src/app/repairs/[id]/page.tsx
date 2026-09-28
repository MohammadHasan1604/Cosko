import { redirect } from 'next/navigation';

/**
 * Standalone Repairs module has been decommissioned.
 * Repair history is preserved read-only in Customer 360 views.
 */
export default function RepairDetailPage() {
  redirect('/customers');
}

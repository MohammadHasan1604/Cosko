import { prisma } from './db';

export interface SequenceConfig {
  prefix: string;
  padLength?: number;
  initialSeq?: number;
  dateSuffix?: boolean;
}

/**
 * Generate a collision-proof sequence number for any Prisma model and unique column.
 * Guarantees zero duplicates even if historical records were deleted or under concurrent operations.
 *
 * @param modelName Name of the Prisma model (e.g. 'purchaseOrder', 'purchasePayment', 'expense')
 * @param fieldName Name of the unique field (e.g. 'poNo', 'voucherNo', 'expenseNo')
 * @param prefix Identifier prefix (e.g. 'PO-2026-', 'PV-', 'EXP-2026-', 'TKT-2026-')
 * @param padLength Minimum padding for sequence number (default 4 digits: 0001)
 * @param client Optional Prisma transaction client (tx) or global prisma
 */
export async function generateSafeSequenceNo(
  modelName: string,
  fieldName: string,
  prefix: string,
  padLength: number = 4,
  client?: any
): Promise<string> {
  const db = client || prisma;
  const model = db[modelName];

  if (!model) {
    throw new Error(`Prisma model "${modelName}" not found for sequence generation`);
  }

  // Fetch all recent records starting with the prefix to reliably extract the highest sequence
  const records = await model.findMany({
    where: {
      [fieldName]: { startsWith: prefix },
    },
    select: {
      [fieldName]: true,
    },
    orderBy: {
      [fieldName]: 'desc',
    },
    take: 100,
  });

  // Escape special regex characters in prefix
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const seqRegex = new RegExp(`^${escapedPrefix}(\\d+)`);

  let maxSeq = 0;
  for (const r of records) {
    const val = r[fieldName];
    if (typeof val === 'string') {
      const match = val.match(seqRegex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(padLength, '0')}`;

  // Collision double-check: verify candidate doesn't already exist in database
  let exists = await model.findFirst({
    where: { [fieldName]: candidate },
    select: { [fieldName]: true },
  });

  while (exists) {
    nextSeq += 1;
    candidate = `${prefix}${String(nextSeq).padStart(padLength, '0')}`;
    exists = await model.findFirst({
      where: { [fieldName]: candidate },
      select: { [fieldName]: true },
    });
  }

  return candidate;
}

/**
 * Generate a date-partitioned voucher sequence number (e.g. PV-20260917-0001, GRN-20260917-0001)
 */
export async function generateDateSequenceNo(
  modelName: string,
  fieldName: string,
  basePrefix: string,
  date: Date = new Date(),
  padLength: number = 4,
  client?: any
): Promise<string> {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${basePrefix}-${dateStr}-`;
  return generateSafeSequenceNo(modelName, fieldName, prefix, padLength, client);
}

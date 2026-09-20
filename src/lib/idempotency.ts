import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface InMemoryRecord {
  timestamp: number;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  responseCode?: number;
  data?: any;
  promise?: Promise<any>;
}

// In-memory hot cache for instant sub-millisecond double-click protection
const inMemoryCache = new Map<string, InMemoryRecord>();

// Clean in-memory keys older than 3 minutes
function cleanMemoryCache() {
  const now = Date.now();
  for (const [k, v] of inMemoryCache.entries()) {
    if (now - v.timestamp > 180_000) {
      inMemoryCache.delete(k);
    }
  }
}

// Periodically clean memory cache
if (typeof setInterval !== 'undefined') {
  setInterval(cleanMemoryCache, 60_000);
}

export interface IdempotencyOptions {
  action: string;
  key?: string;
  userId?: string;
  storeCode?: string;
  ttlSeconds?: number;
  extractEntityId?: (result: any) => string | undefined;
}

/**
 * Extract or generate an idempotency key from request headers or body
 */
export function extractIdempotencyKey(req: NextRequest, body?: any): string | null {
  const headerKey = req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key');
  if (headerKey && headerKey.trim()) {
    return headerKey.trim();
  }
  if (body && typeof body === 'object' && body.idempotencyKey && String(body.idempotencyKey).trim()) {
    return String(body.idempotencyKey).trim();
  }
  return null;
}

/**
 * Execute an API operation with end-to-end database & in-memory idempotency protection
 */
export async function executeWithIdempotency<T = any>(
  req: NextRequest,
  options: IdempotencyOptions,
  handler: (idempotencyKey: string) => Promise<{ status?: number; data: T; headers?: Record<string, string> }>
): Promise<NextResponse> {
  cleanMemoryCache();

  const providedKey = options.key || extractIdempotencyKey(req);
  // If no key provided, generate one to safeguard the request
  const idempotencyKey = providedKey || `gen_${options.action}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ttlSeconds = options.ttlSeconds || 86400; // 24 hours default
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // 1. FAST-PATH: Check in-memory cache for instant double-click interception
  const memRecord = inMemoryCache.get(idempotencyKey);
  if (memRecord) {
    if (memRecord.status === 'COMPLETED' && memRecord.data !== undefined) {
      return NextResponse.json(memRecord.data, {
        status: memRecord.responseCode || 200,
        headers: {
          'x-idempotent-replay': 'true',
          'x-cache-status': 'IDEMPOTENT_REPLAY',
          'x-idempotency-key': idempotencyKey,
        },
      });
    }
    if (memRecord.status === 'PROCESSING') {
      if (memRecord.promise) {
        try {
          const awaited = await memRecord.promise;
          return NextResponse.json(awaited.data, {
            status: awaited.status || 200,
            headers: {
              'x-idempotent-replay': 'true',
              'x-cache-status': 'IDEMPOTENT_REPLAY',
              'x-idempotency-key': idempotencyKey,
            },
          });
        } catch {
          // If in-flight promise failed, proceed to retry
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Duplicate request detected: This action is currently being processed. Please wait...',
            isProcessing: true,
          },
          { status: 409, headers: { 'Retry-After': '2' } }
        );
      }
    }
  }

  // Pre-claim memory cache immediately to intercept concurrent microtasks in same process
  let resolvePromise: (value: any) => void = () => {};
  let rejectPromise: (reason?: any) => void = () => {};
  const inFlightPromise = new Promise<{ status: number; data: any }>((res, rej) => {
    resolvePromise = res;
    rejectPromise = rej;
  });
  inFlightPromise.catch(() => {});

  inMemoryCache.set(idempotencyKey, {
    timestamp: Date.now(),
    status: 'PROCESSING',
    promise: inFlightPromise,
  });

  // 2. PERSISTENT DB-PATH: Check or acquire idempotency lock in MySQL
  let dbRecord: any = null;
  try {
    dbRecord = await prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });
  } catch (dbErr) {
    console.warn('[Idempotency] Could not query idempotency_records:', dbErr);
  }

  if (dbRecord) {
    // If completed, replay saved response
    if (dbRecord.status === 'COMPLETED' && dbRecord.responseData) {
      try {
        const parsed = JSON.parse(dbRecord.responseData);
        inMemoryCache.set(idempotencyKey, {
          timestamp: Date.now(),
          status: 'COMPLETED',
          responseCode: dbRecord.responseCode || 200,
          data: parsed,
        });
        return NextResponse.json(parsed, {
          status: dbRecord.responseCode || 200,
          headers: {
            'x-idempotent-replay': 'true',
            'x-cache-status': 'IDEMPOTENT_REPLAY',
            'x-idempotency-key': idempotencyKey,
          },
        });
      } catch (parseErr) {
        console.warn('[Idempotency] Failed to parse cached responseData:', parseErr);
      }
    }

    // If still marked PROCESSING and not expired (less than 45 seconds old), reject concurrent duplicate
    const recordAgeMs = Date.now() - new Date(dbRecord.createdAt).getTime();
    if (dbRecord.status === 'PROCESSING' && recordAgeMs < 45_000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction in progress: A request with this transaction key is already being processed.',
          isProcessing: true,
        },
        { status: 409, headers: { 'Retry-After': '3' } }
      );
    }
  }

  // 3. ACQUIRE LOCK: Create or reset record as PROCESSING
  try {
    await prisma.idempotencyRecord.upsert({
      where: { key: idempotencyKey },
      create: {
        key: idempotencyKey,
        action: options.action,
        status: 'PROCESSING',
        userId: options.userId || null,
        storeCode: options.storeCode || null,
        expiresAt,
      },
      update: {
        status: 'PROCESSING',
        action: options.action,
        userId: options.userId || null,
        storeCode: options.storeCode || null,
        expiresAt,
        updatedAt: new Date(),
      },
    });
  } catch (lockErr: any) {
    // If concurrent insert conflict occurred (P2002), another thread won the race
    if (lockErr?.code === 'P2002' || String(lockErr?.message).includes('Unique constraint')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction in progress: A duplicate request is already processing.',
          isProcessing: true,
        },
        { status: 409, headers: { 'Retry-After': '3' } }
      );
    }
    console.warn('[Idempotency] Failed to upsert idempotency lock:', lockErr);
  }

  // 4. EXECUTE THE ATOMIC WORKFLOW
  try {
    const result = await handler(idempotencyKey);
    const statusCode = result.status || 200;
    const responsePayload = result.data;
    const entityId = options.extractEntityId ? options.extractEntityId(responsePayload) : undefined;

    // Resolve in-memory promise for in-flight waiters
    resolvePromise({ status: statusCode, data: responsePayload });
    inMemoryCache.set(idempotencyKey, {
      timestamp: Date.now(),
      status: 'COMPLETED',
      responseCode: statusCode,
      data: responsePayload,
    });

    // Mark as COMPLETED in DB synchronously to ensure instant replay consistency
    try {
      await prisma.idempotencyRecord.update({
        where: { key: idempotencyKey },
        data: {
          status: 'COMPLETED',
          responseCode: statusCode,
          responseData: JSON.stringify(responsePayload),
          entityId: entityId || null,
          updatedAt: new Date(),
        },
      });
    } catch (dbUpdateErr) {
      console.warn('[Idempotency] Failed to mark completed in DB:', dbUpdateErr);
    }

    const responseHeaders = {
      'x-idempotency-key': idempotencyKey,
      ...(result.headers || {}),
    };

    return NextResponse.json(responsePayload, {
      status: statusCode,
      headers: responseHeaders,
    });
  } catch (err: any) {
    // On genuine failure: release in-memory lock and delete record from DB so retry is allowed
    rejectPromise(err);
    inMemoryCache.delete(idempotencyKey);

    try {
      await prisma.idempotencyRecord.delete({ where: { key: idempotencyKey } });
    } catch {
      // Ignore cleanup error
    }

    return NextResponse.json(
      { error: err.message || 'Operation failed' },
      { status: err.status || 500 }
    );
  }
}

import { prisma } from '../src/lib/db';
import { executeWithIdempotency, extractIdempotencyKey } from '../src/lib/idempotency';
import { NextRequest } from 'next/server';

async function runIdempotencyVerification() {
  console.log('=== VERIFYING GLOBAL TWO-STEP & TRANSACTION-SAFE IDEMPOTENCY SYSTEM ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Verify idempotency_records table in MySQL schema
  console.log('--- 1. Checking MySQL Schema for idempotency_records Table ---');
  try {
    const rawCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'idempotency_records'
    `);
    const colNames = rawCols.map((c: any) => c.COLUMN_NAME);
    assert(colNames.includes('key'), 'Table `idempotency_records` has `key` column');
    assert(colNames.includes('action'), 'Table `idempotency_records` has `action` column');
    assert(colNames.includes('status'), 'Table `idempotency_records` has `status` column');
    assert(colNames.includes('response_code'), 'Table `idempotency_records` has `response_code` column');
    assert(colNames.includes('response_data'), 'Table `idempotency_records` has `response_data` column');
    assert(colNames.includes('entity_id'), 'Table `idempotency_records` has `entity_id` column');
  } catch (err: any) {
    assert(false, `Database query for idempotency_records failed: ${err.message}`);
  }

  // 2. Test key extraction from headers and body
  console.log('\n--- 2. Testing Idempotency Key Extraction ---');
  const dummyUrl = 'http://localhost:3000/api/sales';
  const reqWithHeader = new NextRequest(dummyUrl, {
    method: 'POST',
    headers: { 'x-idempotency-key': 'test-header-key-12345' },
  });
  const extractedHeaderKey = extractIdempotencyKey(reqWithHeader);
  assert(extractedHeaderKey === 'test-header-key-12345', 'Extracted x-idempotency-key from HTTP headers');

  const reqWithBody = new NextRequest(dummyUrl, { method: 'POST' });
  const extractedBodyKey = extractIdempotencyKey(reqWithBody, { idempotencyKey: 'test-body-key-67890' });
  assert(extractedBodyKey === 'test-body-key-67890', 'Extracted idempotencyKey from request JSON body');

  // 3. Test Concurrent Duplicate Execution Protection (Race Condition Defense)
  console.log('\n--- 3. Testing Concurrent Duplicate Protection (Sub-Millisecond Race Condition Defense) ---');
  const testIdempotencyKey = `test_race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let executionCount = 0;

  const testReq = new NextRequest(dummyUrl, {
    method: 'POST',
    headers: { 'x-idempotency-key': testIdempotencyKey },
  });

  // Launch 5 simultaneous requests with the identical key
  const promises = Array.from({ length: 5 }).map(async (_, idx) => {
    return executeWithIdempotency(
      testReq,
      {
        action: 'TEST_CONCURRENT_RACE',
        key: testIdempotencyKey,
        ttlSeconds: 60,
      },
      async () => {
        executionCount++;
        // Simulate real database write latency
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          status: 201,
          data: {
            success: true,
            message: 'Original operation executed',
            runId: executionCount,
          },
        };
      }
    );
  });

  const responses = await Promise.all(promises);
  const jsonBodies = await Promise.all(responses.map((r) => r.json()));

  assert(executionCount === 1, `Target function executed exactly 1 time across 5 concurrent requests (executed: ${executionCount})`);

  // Verify that the responses returned were either 201 (replay or success) or 409 (locked in flight)
  const successResponses = responses.filter((r) => r.status === 201);
  const conflictResponses = responses.filter((r) => r.status === 409);

  assert(successResponses.length >= 1, `At least 1 request completed with HTTP 201 (got ${successResponses.length})`);
  console.log(`Concurrent test breakdown: ${successResponses.length} succeeded/replayed (201), ${conflictResponses.length} deduplicated/locked (409)`);

  // 4. Test Idempotent Replay from Completed DB Record
  console.log('\n--- 4. Testing Persistent Idempotent Replay from MySQL ---');
  const replayReq = new NextRequest(dummyUrl, {
    method: 'POST',
    headers: { 'x-idempotency-key': testIdempotencyKey },
  });

  let replayedFunctionExecuted = false;
  const replayResponse = await executeWithIdempotency(
    replayReq,
    {
      action: 'TEST_CONCURRENT_RACE',
      key: testIdempotencyKey,
    },
    async () => {
      replayedFunctionExecuted = true;
      return { status: 201, data: { success: true, runId: 999 } };
    }
  );

  const replayJson = await replayResponse.json();
  assert(!replayedFunctionExecuted, 'Handler function was NOT re-executed for previously completed key');
  assert(replayResponse.status === 201, 'Replay returned identical status code 201');
  assert(replayJson.runId === 1, 'Replay returned exact cached payload from initial execution');
  assert(replayResponse.headers.get('x-cache-status') === 'IDEMPOTENT_REPLAY', 'Response header contains x-cache-status: IDEMPOTENT_REPLAY');

  // 5. Test Genuine Failure Unlock (Re-enable on genuine failure)
  console.log('\n--- 5. Testing Genuine Failure Unlock & Safe Retry ---');
  const failKey = `test_fail_${Date.now()}`;
  const failReq = new NextRequest(dummyUrl, {
    method: 'POST',
    headers: { 'x-idempotency-key': failKey },
  });

  let failAttemptCount = 0;
  try {
    await executeWithIdempotency(
      failReq,
      {
        action: 'TEST_FAILURE_UNLOCK',
        key: failKey,
      },
      async () => {
        failAttemptCount++;
        throw new Error('Database transaction deadlocked / simulation error');
      }
    );
  } catch (e: any) {
    // Expected failure
  }

  assert(failAttemptCount === 1, 'Initial failing attempt executed');

  // Verify that the failed key was removed from DB so a genuine retry CAN proceed
  let retrySucceeded = false;
  try {
    const retryRes = await executeWithIdempotency(
      failReq,
      {
        action: 'TEST_FAILURE_UNLOCK',
        key: failKey,
      },
      async () => {
        failAttemptCount++;
        return { status: 200, data: { success: true, retryRun: true } };
      }
    );
    if (retryRes.status === 200) {
      retrySucceeded = true;
    }
  } catch (e: any) {
    retrySucceeded = false;
  }

  assert(retrySucceeded, 'Key unlocked after genuine failure allowing retry to successfully execute');
  assert(failAttemptCount === 2, 'Retry attempt was properly accepted and executed');

  // Cleanup test keys
  try {
    await prisma.idempotencyRecord.deleteMany({
      where: {
        key: {
          in: [testIdempotencyKey, failKey],
        },
      },
    });
    console.log('\nCleaned up verification test records.');
  } catch {}

  console.log(`\n=== FINAL RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runIdempotencyVerification()
  .catch((err) => {
    console.error('Fatal verification error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

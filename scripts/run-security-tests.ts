/**
 * Command line runner for COSKO Security Audit Test Suite
 */
import { runSecurityAuditTestSuite } from '../src/lib/securityAuditTest';

async function main() {
  console.log('====================================================================');
  console.log('COSKO ENTERPRISE SYSTEM — AUTOMATED SECURITY & RBAC AUDIT TEST SUITE');
  console.log('====================================================================\n');

  const report = await runSecurityAuditTestSuite();

  console.log(`Total Test Cases Executed : ${report.totalTests}`);
  console.log(`Passed Test Cases         : ${report.passedCount}`);
  console.log(`Failed Test Cases         : ${report.failedCount}\n`);

  console.log('--------------------------------------------------------------------');
  console.log('DETAILED TEST VERIFICATION RESULTS:');
  console.log('--------------------------------------------------------------------');

  report.results.forEach((r, idx) => {
    const statusSymbol = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${idx + 1}. ${statusSymbol} [${r.category}] ${r.testName}`);
    console.log(`   Expected: ${r.expectedResult} | Actual: ${r.actualResult}`);
    console.log(`   Details : ${r.details}\n`);
  });

  if (report.failedCount > 0) {
    console.error('⚠️ SECURITY AUDIT TEST FAILED: Unsatisfied security constraints detected.');
    process.exit(1);
  } else {
    console.log('🏆 SECURITY AUDIT SUCCESSFUL: All 15 security & performance test cases passed!');
  }
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});

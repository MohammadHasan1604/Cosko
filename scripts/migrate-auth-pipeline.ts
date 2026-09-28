/**
 * Phase 1 Script: Mass-replace getAuthUserFromRequest with authenticateRequest
 * across all API route files.
 * 
 * This script performs two replacements in each file:
 * 1. Replace the import line
 * 2. Replace each auth block pattern  
 */
import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.join(__dirname, '..', 'src', 'app', 'api');

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry.name === 'route.ts') {
      results.push(full);
    }
  }
  return results;
}

const files = findRouteFiles(API_DIR);
let modified = 0;
let skipped = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('getAuthUserFromRequest')) {
    skipped++;
    continue;
  }

  const relPath = path.relative(path.join(__dirname, '..'), file);

  // 1. Replace import
  // Pattern: import { getAuthUserFromRequest } from '@/lib/auth';
  // OR: import { getAuthUserFromRequest, ... } from '@/lib/auth';
  if (content.includes("import { getAuthUserFromRequest }")) {
    content = content.replace(
      /import\s*\{\s*getAuthUserFromRequest\s*\}\s*from\s*['"]@\/lib\/auth['"];?/g,
      "import { authenticateRequest, hasPermission, createAuditLog } from '@/lib/authPipeline';"
    );
  } else {
    // Multi-import: just remove getAuthUserFromRequest from the import and add new import
    content = content.replace(/,?\s*getAuthUserFromRequest\s*,?/g, (match) => {
      // Clean up leading/trailing commas
      return match.startsWith(',') && match.endsWith(',') ? ',' : '';
    });
    if (!content.includes('authenticateRequest')) {
      // Add import line after existing auth import
      const importInsertPoint = content.indexOf("from '@/lib/auth'");
      if (importInsertPoint > 0) {
        const lineEnd = content.indexOf('\n', importInsertPoint);
        content = content.slice(0, lineEnd + 1) +
          "import { authenticateRequest, hasPermission, createAuditLog } from '@/lib/authPipeline';\n" +
          content.slice(lineEnd + 1);
      } else {
        // Just prepend
        content = "import { authenticateRequest, hasPermission, createAuditLog } from '@/lib/authPipeline';\n" + content;
      }
    }
  }

  // 2. Replace auth block patterns:
  // Pattern A: const user = getAuthUserFromRequest(req); if (!user) { return ... 401 }
  // Pattern B: const session = getAuthUserFromRequest(request); if (!session) { return ... 401 }
  
  // Generic replacement for "const VAR = getAuthUserFromRequest(REQ);" followed by if (!VAR)
  content = content.replace(
    /const\s+(user|session)\s*=\s*getAuthUserFromRequest\s*\(\s*(req|request)\s*\)\s*;?\s*\n\s*\n?\s*if\s*\(\s*!\s*\1\s*\)\s*\{\s*\n\s*return\s+NextResponse\.json\s*\(\s*\{[^}]*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;?\s*\n\s*\}/gm,
    (match, varName, reqName) => {
      return `const auth = await authenticateRequest(${reqName});
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const ${varName} = auth.user;`;
    }
  );

  // Simpler pattern without newline gap
  content = content.replace(
    /const\s+(user|session)\s*=\s*getAuthUserFromRequest\s*\(\s*(req|request)\s*\)\s*;?\s*\n\s*if\s*\(\s*!\s*\1\s*\)\s*\{\s*\n\s*return\s+NextResponse\.json\s*\(\s*\{[^}]*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;?\s*\n\s*\}/gm,
    (match, varName, reqName) => {
      return `const auth = await authenticateRequest(${reqName});
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const ${varName} = auth.user;`;
    }
  );

  // Catch any remaining standalone getAuthUserFromRequest calls
  content = content.replace(
    /const\s+(user|session)\s*=\s*getAuthUserFromRequest\s*\(\s*(req|request)\s*\)\s*;/g,
    (match, varName, reqName) => {
      return `const _authResult = await authenticateRequest(${reqName});
    if (!_authResult.user) {
      return NextResponse.json({ error: _authResult.error }, { status: _authResult.status });
    }
    const ${varName} = _authResult.user;`;
    }
  );

  // Clean up any leftover empty auth imports
  content = content.replace(/import\s*\{\s*\}\s*from\s*['"]@\/lib\/auth['"];?\n?/g, '');
  content = content.replace(/import\s*\{\s*,\s*\}\s*from\s*['"]@\/lib\/auth['"];?\n?/g, '');
  
  // Deduplicate our import if it was added multiple times
  const importLine = "import { authenticateRequest, hasPermission, createAuditLog } from '@/lib/authPipeline';";
  const firstOccurrence = content.indexOf(importLine);
  if (firstOccurrence >= 0) {
    let secondOccurrence = content.indexOf(importLine, firstOccurrence + importLine.length);
    while (secondOccurrence >= 0) {
      content = content.slice(0, secondOccurrence) + content.slice(secondOccurrence + importLine.length + 1);
      secondOccurrence = content.indexOf(importLine, firstOccurrence + importLine.length);
    }
  }

  fs.writeFileSync(file, content, 'utf8');
  modified++;
  console.log(`✅ ${relPath}`);
}

console.log(`\n📊 Done: ${modified} files modified, ${skipped} files skipped (already hardened)`);

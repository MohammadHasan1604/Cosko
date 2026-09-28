/**
 * DEPRECATED: /api/users/delete is consolidated into DELETE /api/users
 * This file redirects to the authoritative endpoint to prevent weaker alternate paths.
 * Phase 1 Security: Eliminate duplicate user-management endpoints.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint has been consolidated. Use DELETE /api/users instead.',
      redirect: '/api/users',
    },
    { status: 410 }
  );
}

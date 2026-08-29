import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { executeStockTransfer, CreateTransferInput } from '@/lib/services/transferService';

/**
 * GET /api/transfers - Retrieve stock transfers
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transfers = await prisma.stockTransfer.findMany({
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return NextResponse.json({ success: true, transfers });
  } catch (error: any) {
    console.error('API /api/transfers GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve transfers' }, { status: 500 });
  }
}

/**
 * POST /api/transfers - Execute atomic stock transfer
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only Super Admin and Store Managers can create transfers
    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level for stock transfer' }, { status: 403 });
    }

    const body: CreateTransferInput = await req.json();

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Transfer items cannot be empty' }, { status: 400 });
    }

    const transfer = await executeStockTransfer({
      ...body,
      requestedBy: user.name,
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/transfers POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process stock transfer' }, { status: 500 });
  }
}

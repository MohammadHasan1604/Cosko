import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { executeStockTransfer, CreateTransferInput } from '@/lib/services/transferService';

/**
 * GET /api/transfers - Retrieve stock transfers with store isolation
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');

    const where: any = {};

    if (user.role !== 'Super Admin') {
      where.OR = [
        { sourceStore: user.store },
        { destStore: user.store },
      ];
    } else if (store && store !== 'All Stores') {
      where.OR = [
        { sourceStore: store },
        { destStore: store },
      ];
    }

    const transfers = await prisma.stockTransfer.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                brand: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return NextResponse.json(
      { success: true, transfers },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
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
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only Super Admin and Store Managers can create transfers
    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level for stock transfer' }, { status: 403 });
    }

    const body: CreateTransferInput = await req.json();

    if (!body.sourceStore || !body.destStore) {
      return NextResponse.json({ error: 'Source store and destination store are required' }, { status: 400 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Transfer items cannot be empty' }, { status: 400 });
    }

    // Store isolation check for Store Managers
    if (user.role !== 'Super Admin') {
      if (body.sourceStore !== user.store && !user.allowedStores?.includes(body.sourceStore)) {
        return NextResponse.json(
          { error: `Forbidden: You are not authorized to transfer inventory out of store "${body.sourceStore}"` },
          { status: 403 }
        );
      }
    }

    const transfer = await executeStockTransfer({
      ...body,
      requestedBy: user.name,
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/transfers POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process stock transfer' }, { status: 400 });
  }
}

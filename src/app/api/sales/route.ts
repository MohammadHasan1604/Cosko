import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { executePOSCheckout, CreateSaleInput } from '@/lib/services/salesService';

/**
 * GET /api/sales - Retrieve sales orders with store isolation
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedStore = searchParams.get('store');

    // Store isolation check
    let storeFilter: string | undefined = undefined;
    if (user.role !== 'Super Admin') {
      storeFilter = user.store;
    } else if (requestedStore && requestedStore !== 'All Stores') {
      storeFilter = requestedStore;
    }

    const whereClause: any = {};
    if (storeFilter) {
      whereClause.storeCode = storeFilter;
    }

    const sales = await prisma.salesOrder.findMany({
      where: whereClause,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return NextResponse.json({ success: true, sales });
  } catch (error: any) {
    console.error('API /api/sales GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve sales records' }, { status: 500 });
  }
}

/**
 * POST /api/sales - Execute POS Checkout atomically
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateSaleInput = await req.json();

    // Verify cashier store authorization
    if (user.role !== 'Super Admin' && user.store !== body.storeCode) {
      return NextResponse.json({ error: 'Store Scope Lock: Cashier cannot execute sales for unauthorized store' }, { status: 403 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Cart cannot be empty' }, { status: 400 });
    }

    const sale = await executePOSCheckout({
      ...body,
      cashierName: user.name,
    });

    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/sales POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process checkout transaction' }, { status: 500 });
  }
}

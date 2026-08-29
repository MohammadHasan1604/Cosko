import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/expenses - Retrieve store/central expenses
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
    const store = searchParams.get('store');

    const whereClause: any = {};
    if (user.role !== 'Super Admin') {
      whereClause.storeCode = user.store;
    } else if (store && store !== 'All Stores') {
      whereClause.storeCode = store;
    }

    const expenses = await (prisma as any).expense.findMany({
      where: whereClause,
      orderBy: {
        date: 'desc',
      },
      take: 100,
    });

    return NextResponse.json({ success: true, expenses });
  } catch (error: any) {
    console.error('API /api/expenses GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve expenses' }, { status: 500 });
  }
}

/**
 * POST /api/expenses - Record a store or Central operational expense
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level to record expenses' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.category || !body.amount) {
      return NextResponse.json({ error: 'Category and Amount are required' }, { status: 400 });
    }

    const count = await (prisma as any).expense.count();
    const expenseNo = `EXP-2026-${String(count + 1).padStart(4, '0')}`;

    const expense = await (prisma as any).expense.create({
      data: {
        expenseNo,
        category: body.category,
        amount: Number(body.amount),
        storeCode: body.storeCode || user.store,
        description: body.description || '',
        paymentMethod: body.paymentMethod || 'Bank Transfer',
        approvedBy: user.name,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/expenses POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record expense' }, { status: 500 });
  }
}

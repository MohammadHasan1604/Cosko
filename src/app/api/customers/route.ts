import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeMobileNumber } from '@/context/AppContext';

/**
 * GET /api/customers - Search customer by normalized phone or query
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
    const phone = searchParams.get('phone');
    const query = searchParams.get('query');

    if (phone) {
      const normalized = normalizeMobileNumber(phone);
      const customer = await (prisma as any).customer.findFirst({
        where: {
          normalizedPhone: {
            contains: normalized,
          },
        },
      });
      return NextResponse.json({ success: true, customer });
    }

    const whereClause: any = {};
    if (query) {
      whereClause.OR = [
        { name: { contains: query } },
        { phone: { contains: query } },
        { email: { contains: query } },
      ];
    }

    const customers = await (prisma as any).customer.findMany({
      where: whereClause,
      orderBy: {
        totalSpent: 'desc',
      },
      take: 100,
    });

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    console.error('API /api/customers GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve customer records' }, { status: 500 });
  }
}

/**
 * POST /api/customers - Create or update Customer Master profile
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.name || !body.phone) {
      return NextResponse.json({ error: 'Customer Name and Phone are required' }, { status: 400 });
    }

    const normalizedPhone = normalizeMobileNumber(body.phone);

    const existingCustomer = await (prisma as any).customer.findFirst({
      where: { normalizedPhone },
    });

    let customer;
    if (existingCustomer) {
      customer = await (prisma as any).customer.update({
        where: { id: existingCustomer.id },
        data: {
          name: body.name,
          email: body.email || undefined,
          address: body.address || undefined,
          city: body.city || undefined,
        },
      });
    } else {
      customer = await (prisma as any).customer.create({
        data: {
          name: body.name,
          phone: body.phone,
          normalizedPhone,
          email: body.email || null,
          address: body.address || null,
          city: body.city || user.store,
          totalSpent: body.totalSpend || 0,
          creditBalance: body.creditBalance || 0,
          status: 'Active',
        },
      });
    }

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/customers POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save customer' }, { status: 500 });
  }
}

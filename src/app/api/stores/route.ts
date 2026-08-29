import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/stores - Retrieve all store hubs
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stores = await prisma.storeHub.findMany({
      orderBy: {
        code: 'asc',
      },
    });

    return NextResponse.json({ success: true, stores });
  } catch (error: any) {
    console.error('API /api/stores GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve store hubs' }, { status: 500 });
  }
}

/**
 * POST /api/stores - Create or update store hub (Super Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.code || !body.name || !body.city) {
      return NextResponse.json({ error: 'Store Code, Name, and City are required' }, { status: 400 });
    }

    const store = await prisma.storeHub.upsert({
      where: { code: body.code.toUpperCase() },
      create: {
        code: body.code.toUpperCase(),
        name: body.name,
        city: body.city,
        address: body.address || 'COSKO Retail Hub',
        managerName: body.managerName || null,
        phone: body.phone || null,
        registersCount: body.registersCount || 2,
        status: body.status || 'Active',
      },
      update: {
        name: body.name,
        city: body.city,
        address: body.address || undefined,
        managerName: body.managerName || undefined,
        phone: body.phone || undefined,
        registersCount: body.registersCount || undefined,
        status: body.status || undefined,
      },
    });

    return NextResponse.json({ success: true, store }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/stores POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save store hub' }, { status: 500 });
  }
}

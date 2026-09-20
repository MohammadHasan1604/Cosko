import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const DEFAULT_UNITS = [
  { name: 'Piece', code: 'pcs', symbol: 'pcs', description: 'Individual piece or count unit', status: 'Active' },
  { name: 'Box', code: 'box', symbol: 'bx', description: 'Packaged carton or box', status: 'Active' },
  { name: 'Set', code: 'set', symbol: 'set', description: 'Kit or combined assembly set', status: 'Active' },
  { name: 'Kilogram', code: 'kg', symbol: 'kg', description: 'Weight in kilograms', status: 'Active' },
  { name: 'Meter', code: 'meter', symbol: 'm', description: 'Length in linear meters', status: 'Active' },
  { name: 'Pack', code: 'pack', symbol: 'pk', description: 'Multipack unit', status: 'Active' },
];

export async function GET(req: NextRequest) {
  try {
    let items = await prisma.unit.findMany({
      orderBy: [{ name: 'asc' }],
    });

    if (items.length === 0) {
      for (const def of DEFAULT_UNITS) {
        await prisma.unit.upsert({
          where: { name: def.name },
          update: {},
          create: def,
        });
      }

      items = await prisma.unit.findMany({
        orderBy: [{ name: 'asc' }],
      });
    }

    return NextResponse.json({
      success: true,
      units: items,
      totalCount: items.length,
    });
  } catch (error: any) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch units' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const body = await req.json();

    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Unit name is required' },
        { status: 400 }
      );
    }

    const code =
      body?.code?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 16);

    const symbol = body?.symbol?.trim() || code;
    const description = body?.description?.trim() || null;
    const status = body?.status === 'Inactive' ? 'Inactive' : 'Active';

    // Duplicate check
    const existing = await prisma.unit.findFirst({
      where: {
        OR: [
          { name: { equals: name } },
          { code: { equals: code } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: true, unit: existing, message: 'Unit already exists' },
        { status: 200 }
      );
    }

    const created = await prisma.unit.create({
      data: {
        name,
        code,
        symbol,
        description,
        status,
      },
    });

    broadcastRealtimeEvent('units', 'UNIT_CREATED', created);

    return NextResponse.json(
      { success: true, unit: created, message: 'Unit created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating unit:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create unit' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const body = await req.json();

    const id = body?.id?.trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Unit ID is required' },
        { status: 400 }
      );
    }

    const updated = await prisma.unit.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        symbol: body.symbol?.trim(),
        description: body.description?.trim() || null,
        status: body.status,
      },
    });

    broadcastRealtimeEvent('units', 'UNIT_UPDATED', updated);

    return NextResponse.json({
      success: true,
      unit: updated,
      message: 'Unit updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating unit:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update unit' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Unit ID is required' },
        { status: 400 }
      );
    }

    await prisma.unit.delete({ where: { id } });

    broadcastRealtimeEvent('units', 'UNIT_DELETED', { id });

    return NextResponse.json({
      success: true,
      message: 'Unit deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting unit:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete unit' },
      { status: 500 }
    );
  }
}

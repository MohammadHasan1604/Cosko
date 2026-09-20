import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const DEFAULT_BRANDS = [
  'Apple',
  'Samsung',
  'Google',
  'OnePlus',
  'Xiaomi',
  'Sony',
  'Dell',
  'HP',
  'Lenovo',
  'Asus',
  'Ather',
  'Ola Electric',
  'Generic / OEM',
];

export async function GET(req: NextRequest) {
  try {
    let items = await prisma.brand.findMany({
      orderBy: [{ name: 'asc' }],
    });

    if (items.length === 0) {
      // 1. Gather distinct brands from existing products
      const existingProds = await prisma.product.findMany({
        where: { brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
      });

      const brandNames = new Set<string>();
      DEFAULT_BRANDS.forEach((b) => brandNames.add(b));
      existingProds.forEach((p) => {
        if (p.brand && p.brand.trim()) brandNames.add(p.brand.trim());
      });

      for (const name of brandNames) {
        const code = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        await prisma.brand.upsert({
          where: { name },
          update: {},
          create: {
            name,
            code: code || `br-${Date.now().toString(36)}`,
            status: 'Active',
          },
        });
      }

      items = await prisma.brand.findMany({
        orderBy: [{ name: 'asc' }],
      });
    }

    return NextResponse.json({
      success: true,
      brands: items,
      totalCount: items.length,
    });
  } catch (error: any) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch brands' },
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
        { success: false, error: 'Brand name is required' },
        { status: 400 }
      );
    }

    const code =
      body?.code?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);

    const description = body?.description?.trim() || null;
    const status = body?.status === 'Inactive' ? 'Inactive' : 'Active';

    // Duplicate check
    const existing = await prisma.brand.findFirst({
      where: {
        OR: [
          { name: { equals: name } },
          { code: { equals: code } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: true, brand: existing, message: 'Brand already exists' },
        { status: 200 }
      );
    }

    const created = await prisma.brand.create({
      data: {
        name,
        code,
        description,
        status,
      },
    });

    broadcastRealtimeEvent('brands', 'BRAND_CREATED', created);

    return NextResponse.json(
      { success: true, brand: created, message: 'Brand created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create brand' },
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
        { success: false, error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    const updated = await prisma.brand.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        description: body.description?.trim() || null,
        status: body.status,
      },
    });

    broadcastRealtimeEvent('brands', 'BRAND_UPDATED', updated);

    return NextResponse.json({
      success: true,
      brand: updated,
      message: 'Brand updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update brand' },
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
        { success: false, error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    await prisma.brand.delete({ where: { id } });

    broadcastRealtimeEvent('brands', 'BRAND_DELETED', { id });

    return NextResponse.json({
      success: true,
      message: 'Brand deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete brand' },
      { status: 500 }
    );
  }
}

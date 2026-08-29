import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';

/**
 * GET /api/categories
 * Returns full list of categories ordered by sort_order and name
 */
export async function GET(req: NextRequest) {
  try {
    const categories = await (prisma as any).category.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      categories,
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve categories', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * Creates a new category record
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('cosko_session')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || (session.role !== 'Super Admin' && session.role !== 'Store Manager')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Only Admin or Store Manager can manage categories' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, parentCategoryId, categoryType = 'Product', description, icon, imageUrl, status = 'Active', sortOrder = 0 } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, message: 'Category name is required' }, { status: 400 });
    }

    const baseSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const newCategory = await (prisma as any).category.create({
      data: {
        name: name.trim(),
        slug: uniqueSlug,
        parentCategoryId: parentCategoryId || null,
        categoryType,
        description: description || null,
        icon: icon || null,
        imageUrl: imageUrl || null,
        status,
        sortOrder: Number(sortOrder) || 0,
        createdBy: session.email || session.name,
      },
    });

    return NextResponse.json({
      success: true,
      category: newCategory,
      message: `Category "${newCategory.name}" created successfully`,
    });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create category', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/categories
 * Updates category details or active status
 */
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('cosko_session')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || (session.role !== 'Super Admin' && session.role !== 'Store Manager')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Only Admin or Store Manager can modify categories' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, name, parentCategoryId, categoryType, description, icon, imageUrl, status, sortOrder } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Category ID is required' }, { status: 400 });
    }

    const updated = await (prisma as any).category.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(parentCategoryId !== undefined ? { parentCategoryId: parentCategoryId || null } : {}),
        ...(categoryType ? { categoryType } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(status ? { status } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      category: updated,
      message: `Category "${updated.name}" updated successfully`,
    });
  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update category', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories
 * Safely archives a category
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('cosko_session')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || session.role !== 'Super Admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Only Super Admin can archive categories' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Category ID is required' }, { status: 400 });
    }

    const archived = await (prisma as any).category.update({
      where: { id },
      data: { status: 'Archived' },
    });

    return NextResponse.json({
      success: true,
      category: archived,
      message: `Category "${archived.name}" archived successfully`,
    });
  } catch (error: any) {
    console.error('Error archiving category:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to archive category', error: error.message },
      { status: 500 }
    );
  }
}

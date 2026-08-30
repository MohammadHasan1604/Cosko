import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

/**
 * GET /api/categories
 * Returns full list of categories ordered by sort_order and name (excludes Archived by default)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const where: any = {};
    if (!includeArchived) {
      where.status = { not: 'Archived' };
    }

    const categories = await (prisma as any).category.findMany({
      where,
      include: {
        parent: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(
      {
        success: true,
        categories,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
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
    const session = getAuthUserFromRequest(req);

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
    const session = getAuthUserFromRequest(req);

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
 * Safe Archive or Permanent Delete for unlinked categories
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = getAuthUserFromRequest(req);

    if (!session || (session.role !== 'Super Admin' && session.role !== 'Store Manager')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Only Admin or Store Manager can archive or delete categories' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ success: false, message: 'Category ID is required' }, { status: 400 });
    }

    let target = await (prisma as any).category.findUnique({ where: { id } }).catch(() => null);
    if (!target) {
      target = await (prisma as any).category.findFirst({ where: { slug: id } });
    }

    if (!target) {
      return NextResponse.json({ success: true, message: 'Category already deleted or non-existent' });
    }

    // Check if category is referenced by products
    const [productsLinked, childCategories] = await Promise.all([
      (prisma as any).product.count({
        where: {
          OR: [
            { category: target.name },
            { category: target.slug },
            { subcategory: target.name },
            { subcategory: target.slug },
          ],
        },
      }),
      (prisma as any).category.count({
        where: { parentCategoryId: target.id, status: { not: 'Archived' } },
      }),
    ]);

    const isReferenced = productsLinked > 0 || childCategories > 0;

    // If referenced or not permanent, safe ARCHIVE
    if (isReferenced || !permanent || session.role !== 'Super Admin') {
      const archived = await (prisma as any).category.update({
        where: { id: target.id },
        data: { status: 'Archived' },
      });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        category: archived,
        isReferenced,
        message: isReferenced
          ? `This category is currently in use (${productsLinked} products, ${childCategories} subcategories). Archived safely instead of permanent deletion.`
          : `Category "${archived.name}" archived successfully.`,
      });
    }

    // Hard-delete if safe & requested by Super Admin
    await (prisma as any).category.delete({ where: { id: target.id } });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Category "${target.name}" permanently deleted from database.`,
    });
  } catch (error: any) {
    console.error('Error archiving/deleting category:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to archive/delete category', error: error.message },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, getAuthUserFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authUser = getAuthUserFromRequest(request);
    const body = await request.json();
    const {
      id,
      email,
      name,
      role,
      store,
      status,
      securityLevel,
      password,
      shiftStatus,
      allowedStores,
      assignedStores,
      overrides,
      permissionOverride,
    } = body;

    if (!id && !email) {
      return NextResponse.json({ success: false, error: 'User ID or Email is required' }, { status: 400 });
    }

    const targetUser = await prisma.userAccount.findFirst({
      where: id ? { id } : { email: email.toLowerCase().trim() },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User account not found' }, { status: 404 });
    }

    // 🔒 STRICT SUPER ADMIN SINGLETON: Reject promoting any account to Super Admin
    if (targetUser.role !== 'Super Admin' && (role === 'Super Admin' || Number(securityLevel) === 100)) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: System enforces exactly ONE protected Super Admin. Promoting accounts to Super Admin is prohibited.',
      }, { status: 403 });
    }

    if (authUser && authUser.role !== 'Super Admin') {
      if (targetUser.role === 'Super Admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Only Super Admin can modify Super Admin accounts' }, { status: 403 });
      }
      const callerAllowed = authUser.allowedStores && authUser.allowedStores.length > 0 ? authUser.allowedStores : [authUser.store];
      if (targetUser.storeScope && !callerAllowed.includes(targetUser.storeScope)) {
        return NextResponse.json({ success: false, error: 'Forbidden: You cannot modify users outside your assigned stores' }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (role && targetUser.role !== 'Super Admin') updateData.role = role;
    if (status) updateData.status = status;
    if (securityLevel !== undefined && targetUser.role !== 'Super Admin') updateData.securityLevel = Number(securityLevel);
    if (shiftStatus) updateData.shiftStatus = shiftStatus;

    // 🔒 Protected Super Admin preserves role and All Stores scope unconditionally
    if (targetUser.role === 'Super Admin') {
      updateData.role = 'Super Admin';
      updateData.securityLevel = 100;
      updateData.storeScope = 'All Stores';
    }

    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    // Resolve assigned stores
    const rawStoresToSync: string[] | null = Array.isArray(assignedStores)
      ? assignedStores
      : Array.isArray(allowedStores)
      ? allowedStores
      : store
      ? [store]
      : null;

    let targetStores: string[] | null = null;
    if (rawStoresToSync && targetUser.role !== 'Super Admin') {
      const validHubs = await prisma.storeHub.findMany({ select: { code: true } });
      const validCodes = new Set(validHubs.map((s) => s.code));
      targetStores = rawStoresToSync.filter((c: string) => validCodes.has(c));
      if (targetStores.length > 0) {
        updateData.storeScope = targetStores[0];
      }
    }

    await prisma.$transaction(
      async (tx: any) => {
        const updatedUser = id
          ? await tx.userAccount.update({ where: { id }, data: updateData })
          : await tx.userAccount.update({ where: { email: email.toLowerCase().trim() }, data: updateData });

        const targetUserId = updatedUser.id;
        const isSuperAdmin = updatedUser.role === 'Super Admin';

        // 1. Sync store assignments if provided
        if (targetStores && targetStores.length > 0 && !isSuperAdmin) {
          await tx.userStoreAssignment.deleteMany({
            where: {
              userId: targetUserId,
              storeCode: { notIn: targetStores },
            },
          });

          for (const sCode of targetStores) {
            await tx.userStoreAssignment.upsert({
              where: { userId_storeCode: { userId: targetUserId, storeCode: sCode } },
              create: { userId: targetUserId, storeCode: sCode },
              update: {},
            });
          }
        }

        // 2. Sync full overrides array if provided
        if (Array.isArray(overrides) && !isSuperAdmin) {
          await tx.userPermissionOverride.deleteMany({
            where: { userId: targetUserId },
          });

          for (const ov of overrides) {
            if (ov.permissionCode && (ov.overrideType === 'ALLOW' || ov.overrideType === 'DENY')) {
              await tx.userPermissionOverride.create({
                data: {
                  userId: targetUserId,
                  permissionCode: ov.permissionCode,
                  overrideType: ov.overrideType,
                },
              });
            }
          }
        }

        // 3. Sync single permissionOverride if provided
        if (permissionOverride && permissionOverride.permissionCode && !isSuperAdmin) {
          const { permissionCode, overrideType } = permissionOverride;
          if (overrideType === 'RESET') {
            await tx.userPermissionOverride.deleteMany({
              where: { userId: targetUserId, permissionCode },
            });
          } else if (overrideType === 'ALLOW' || overrideType === 'DENY') {
            await tx.userPermissionOverride.upsert({
              where: { userId_permissionCode: { userId: targetUserId, permissionCode } },
              create: { userId: targetUserId, permissionCode, overrideType },
              update: { overrideType },
            });
          }
        }
      },
      { maxWait: 15000, timeout: 45000 }
    );

    return NextResponse.json({
      success: true,
      message: 'User profile, permissions and store access updated in MySQL database successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { id, email } = await request.json();

    if (!id && !email) {
      return NextResponse.json({ success: false, error: 'User ID or Email is required' }, { status: 400 });
    }

    if (id) {
      await prisma.userAccount.delete({ where: { id } });
    } else if (email) {
      await prisma.userAccount.delete({ where: { email: email.toLowerCase().trim() } });
    }

    return NextResponse.json({ success: true, message: 'User account removed from MySQL database' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

import { prisma } from '../src/lib/db';
import { hashPassword, comparePassword } from '../src/lib/auth';

async function setSuperAdminPassword() {
  const email = process.env.SUPERADMIN_EMAIL || 'cosko@gmail.com';
  const newPassword = process.env.SUPERADMIN_PASSWORD || 'CoskoWajid2026@';

  console.log(`Setting password for Super Admin: ${email}...`);

  const hashedPassword = await hashPassword(newPassword);

  const updated = await prisma.userAccount.update({
    where: { email },
    data: {
      passwordHash: hashedPassword,
      mustChangePassword: false,
      status: 'Active',
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const verified = await comparePassword(newPassword, updated.passwordHash);

  console.log(`✅ Super Admin (${updated.name} - ${updated.email}) updated successfully!`);
  console.log(`✅ Role: ${updated.role}, Security Level: ${updated.securityLevel}`);
  console.log(`✅ Password verification test: ${verified ? 'SUCCESS (Password matches hash)' : 'FAILED'}`);
}

setSuperAdminPassword()
  .catch((err) => {
    console.error('Failed to update Super Admin password:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

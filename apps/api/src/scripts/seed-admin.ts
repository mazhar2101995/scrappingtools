import bcrypt from 'bcryptjs';
import { db, users, organizations, organizationMemberships } from '@saas/database';

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@productintel.internal';
  const password = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const fullName = process.env.ADMIN_NAME || 'Platform Administrator';
  const orgName = 'Platform Master Administration';
  const orgSlug = 'platform-admin';

  console.log(`Creating secure Platform Super Admin: ${email}`);

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.transaction(async (tx) => {
    const [adminUser] = await tx.insert(users).values({
      email,
      passwordHash,
      fullName,
      isSuperadmin: true,
    }).returning();

    const [adminOrg] = await tx.insert(organizations).values({
      name: orgName,
      slug: orgSlug,
      planTier: 'enterprise',
    }).returning();

    await tx.insert(organizationMemberships).values({
      organizationId: adminOrg.id,
      userId: adminUser.id,
      role: 'super_admin',
    });

    return { user: adminUser, organization: adminOrg };
  });

  console.log('--- ADMIN SEED SUCCESSFUL ---');
  console.log(`Email       : ${result.user.email}`);
  console.log(`Role        : super_admin`);
  console.log(`User ID     : ${result.user.id}`);
  console.log(`Org ID      : ${result.organization.id}`);
}

seedAdmin().then(() => process.exit(0)).catch(e => {
  console.error('Failed to seed admin:', e);
  process.exit(1);
});

import { PrismaClient, UserRole } from '@prisma/client'

const db = new PrismaClient()

const USERS: { email: string; name: string; role: UserRole }[] = [
  {
    email: 'growth.ai.consultant@gmail.com',
    name: 'Joel',
    role: UserRole.ADMIN,
  },
  {
    email: 'info@campersnova.com',
    name: 'Esteban',
    role: UserRole.AGENTE,
  },
]

async function main() {
  console.log('Seeding users…')

  for (const user of USERS) {
    const result = await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: { email: user.email, name: user.name, role: user.role },
    })
    console.log(`  ✓ ${result.role.padEnd(6)} ${result.name} <${result.email}>`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

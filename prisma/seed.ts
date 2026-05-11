import { PrismaClient, UserRole } from '@prisma/client'
import { seedReferencePrices } from './seeds/reference-prices'

const db = new PrismaClient()

interface UserSeed {
  email: string
  name: string
  role: UserRole
  active: boolean
  notifyOnNewLead: boolean
}

const USERS: UserSeed[] = [
  {
    email: 'joel.martinez@tutete.com',
    name: 'Joel Martínez',
    role: UserRole.ADMIN,
    active: true,
    notifyOnNewLead: true,
  },
  {
    email: 'info@campersnova.com',
    name: 'Esteban García',
    role: UserRole.ADMIN,
    active: true,
    notifyOnNewLead: true,
  },
  {
    email: 'desire@campersnova.com',
    name: 'Desirée',
    role: UserRole.AGENTE,
    active: true,
    notifyOnNewLead: true,
  },
  {
    // Preservado para integridad referencial — no borrar
    email: 'joelmarfas@gmail.com',
    name: 'Joui',
    role: UserRole.AGENTE,
    active: false,
    notifyOnNewLead: false,
  },
]

async function main() {
  console.log('Seeding users…')

  for (const user of USERS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db.user as any).upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        active: user.active,
        notifyOnNewLead: user.notifyOnNewLead,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
        notifyOnNewLead: user.notifyOnNewLead,
      },
    })
    const status = result.active ? '✓' : '✗'
    console.log(`  ${status} ${result.role.padEnd(6)} ${result.name} <${result.email}>`)
  }

  await seedReferencePrices(db)

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

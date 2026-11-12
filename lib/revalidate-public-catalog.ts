import { revalidatePath } from 'next/cache'

export function revalidatePublicCatalog() {
  revalidatePath('/')
  revalidatePath('/comprar', 'layout')
  revalidatePath('/comprar')
  revalidatePath('/comprar/vehiculos')
  revalidatePath('/comprar/[id]', 'page')
}

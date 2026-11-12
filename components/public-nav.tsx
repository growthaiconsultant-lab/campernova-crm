'use client'

import { usePathname } from 'next/navigation'
import { PublicMenu } from './public-menu'

export function PublicNav({ overPhoto = false }: { overPhoto?: boolean }) {
  const pathname = usePathname()
  return <PublicMenu pathname={pathname} transparent={overPhoto} />
}

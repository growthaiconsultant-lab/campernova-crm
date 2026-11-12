'use client'

import { usePathname } from 'next/navigation'
import { PublicMenu } from './public-menu'

export function PublicNav() {
  return <PublicMenu pathname={usePathname()} />
}

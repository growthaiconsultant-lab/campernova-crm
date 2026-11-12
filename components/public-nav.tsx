'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PublicMenu } from './public-menu'

export function PublicNav({ overPhoto = false }: { overPhoto?: boolean }) {
  const pathname = usePathname()
  const edge = useRef<HTMLSpanElement>(null)
  const [atTop, setAtTop] = useState(true)
  useEffect(() => {
    if (!overPhoto || !edge.current) return
    const observer = new IntersectionObserver(([entry]) => setAtTop(entry.isIntersecting))
    observer.observe(edge.current)
    return () => observer.disconnect()
  }, [overPhoto])
  return (
    <>
      {overPhoto && <span className="cn-home-menu-edge" aria-hidden="true" ref={edge} />}
      <PublicMenu pathname={pathname} transparent={overPhoto && atTop} />
    </>
  )
}

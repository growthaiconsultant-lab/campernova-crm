export const homeFormPaths = {
  '/comprar': '/encuentra-tu-camper',
  '/vender': '/vende-tu-camper',
} as const

export const publicNavigation = [
  { href: '/', label: 'Inicio' },
  { href: homeFormPaths['/comprar'], label: 'Comprar' },
  { href: homeFormPaths['/vender'], label: 'Vender' },
  { href: '/comprar/vehiculos', label: 'Catálogo' },
  { href: '/busqueda-bajo-pedido', label: 'Búsqueda a medida' },
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/sobre', label: 'Sobre nosotros' },
  { href: '/contacto', label: 'Contacto' },
]

export function publicMenuSection(pathname: string) {
  const path = pathname.replace(/\.html$|\/$/g, '') || '/'
  if (path === '/comprar') return homeFormPaths['/comprar']
  if (path === '/vender' || path.startsWith('/vender/')) return homeFormPaths['/vender']
  if (path.startsWith('/comprar/')) return '/comprar/vehiculos'
  return path
}

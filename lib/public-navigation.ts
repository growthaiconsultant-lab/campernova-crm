export const publicNavigation: { href: string; label: string; activePath?: string }[] = [
  { href: '/', label: 'Inicio' },
  { href: '/comprar', label: 'Comprar' },
  { href: '/busqueda-bajo-pedido', label: 'Búsqueda a medida' },
  { href: '/vender', label: 'Vender' },
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/sobre', label: 'Sobre nosotros' },
]

export const homeFormPaths = {
  '/comprar': '/encuentra-tu-camper',
  '/vender': '/vende-tu-camper',
} as const

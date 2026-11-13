import { readFileSync, writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PublicFooter } from '../components/public-footer'
import { PublicMenu } from '../components/public-menu'

for (const slug of ['encuentra-tu-camper', 'vende-tu-camper']) {
  const file = 'public/' + slug + '.html'
  const html = readFileSync(file, 'utf8')
  const header = renderToStaticMarkup(
    createElement(PublicMenu, { pathname: '/' + slug, transparent: true })
  )
  const marker = /<!-- cn-site-menu -->[\s\S]*?<!-- \/cn-site-menu -->/
  if (!marker.test(html)) throw new Error('No se encontró la cabecera en ' + file)
  const footer = renderToStaticMarkup(
    createElement(PublicFooter, { campaign: slug === 'vende-tu-camper' ? 'vender' : 'comprar' })
  )
  const footerMarker = /<!-- cn-site-footer -->[\s\S]*?<!-- \/cn-site-footer -->/
  if (!footerMarker.test(html)) throw new Error('No se encontró el pie en ' + file)
  const synced = html
    .replace(footerMarker, '<!-- cn-site-footer -->' + footer + '<!-- /cn-site-footer -->')
    .replace(marker, '<!-- cn-site-menu -->' + header + '<!-- /cn-site-menu -->')
  if (process.argv.includes('--check')) {
    if (synced !== html) throw new Error('Actualizar la navegación de ' + file)
  } else if (synced !== html) writeFileSync(file, synced)
}

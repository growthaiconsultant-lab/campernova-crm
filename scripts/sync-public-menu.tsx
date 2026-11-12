import { readFileSync, writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PublicMenu } from '../components/public-menu'

for (const slug of ['encuentra-tu-camper', 'vende-tu-camper']) {
  const file = 'public/' + slug + '.html'
  const html = readFileSync(file, 'utf8')
  const header = renderToStaticMarkup(
    createElement(PublicMenu, { pathname: '/' + slug, transparent: true })
  )
  const marker = /<!-- cn-site-menu -->[\s\S]*?<!-- \/cn-site-menu -->/
  if (!marker.test(html)) throw new Error('No se encontró la cabecera en ' + file)
  const synced = html.replace(marker, '<!-- cn-site-menu -->' + header + '<!-- /cn-site-menu -->')
  if (process.argv.includes('--check')) {
    if (synced !== html) throw new Error('Actualizar el menú de ' + file)
  } else if (synced !== html) writeFileSync(file, synced)
}

import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PublicFooter } from '../components/public-footer'
import { PublicMenu } from '../components/public-menu'

it.each(['encuentra-tu-camper', 'vende-tu-camper'])(
  'mantiene el menú compartido en la landing %s',
  (slug) => {
    const html = readFileSync('public/' + slug + '.html', 'utf8')
    const expected = renderToStaticMarkup(
      createElement(PublicMenu, { pathname: '/' + slug, transparent: true })
    )
    const footer = renderToStaticMarkup(
      createElement(PublicFooter, {
        campaign: slug === 'vende-tu-camper' ? 'vender' : 'comprar',
      })
    )
    expect(html).toContain('<!-- cn-site-footer -->' + footer + '<!-- /cn-site-footer -->')
    expect(html).toContain('<!-- cn-site-menu -->' + expected + '<!-- /cn-site-menu -->')
  }
)

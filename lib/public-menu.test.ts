import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PublicMenu } from '../components/public-menu'

it.each(['encuentra-tu-camper', 'vende-tu-camper'])(
  'mantiene el menú compartido en la landing %s',
  (slug) => {
    const html = readFileSync('public/' + slug + '.html', 'utf8')
    const expected = renderToStaticMarkup(createElement(PublicMenu, { pathname: '/' + slug }))
    expect(html).toContain('<!-- cn-site-menu -->' + expected + '<!-- /cn-site-menu -->')
  }
)

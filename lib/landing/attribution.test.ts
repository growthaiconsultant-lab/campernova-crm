import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { LandingAttribution } from '@/components/landing-attribution'
import { landingBuyerSchema } from './buyer-intake'
import { landingSellerSchema } from './seller-intake'
import { landingBuyerPayload } from '@/tests/fixtures/landing-buyer'
import { landingPayload } from '@/tests/fixtures/landing-seller'
import {
  attributionFromActivities,
  formatLandingActivity,
  landingAttributionLine,
  landingAttributionRows,
  landingAttributionSchema,
  landingBuyerSource,
  readLandingAttribution,
} from './attribution'

describe('landing campaign attribution', () => {
  it.each([
    ['instagram', 'INSTAGRAM'],
    ['IG', 'INSTAGRAM'],
    ['facebook', 'META'],
    ['fb', 'META'],
    ['meta', 'META'],
    ['an', 'META'],
    ['other', 'PRO'],
    ['{{site_source_name}}', 'PRO'],
  ])('classifies only explicit %s', (utm_source, source) => {
    expect(landingBuyerSource({ utm_source })).toBe(source)
  })
  it('keeps direct visits unknown even when a campaign name is present', () => {
    expect(landingBuyerSource({ utm_campaign: 'instagram_sale' })).toBe('PRO')
    expect(
      landingAttributionRows({ version: 1, landing: '/vende-tu-camper.html', params: {} })
    ).toContainEqual({ label: 'Origen del enlace', value: 'Sin etiquetas de origen' })
  })
  it.each(['constructor', '__proto__', 'toString'])(
    'renders unknown platform %s as plain text',
    (utm_source) => {
      const content = landingAttributionLine('/encuentra-tu-camper.html', { utm_source }, 'directo')
      expect(landingAttributionRows(readLandingAttribution(content)!)[1].value).toBe(utm_source)
      expect(
        renderToStaticMarkup(createElement(LandingAttribution, { activities: [{ content }] }))
      ).toContain(utm_source)
    }
  )
  it('roundtrips delimiter-containing labels and escapes them in the CRM', () => {
    const params = { utm_source: 'instagram', utm_campaign: '<script> · x=y', ad_id: 'qa_ad' }
    const content =
      landingAttributionLine('/vende-tu-camper.html', params, 'directo') +
      '\nPrioridad indicada: Solo saber cuánto vale'
    const activities = [{ content, agentId: null }]
    expect(attributionFromActivities(activities)?.params).toEqual(params)
    expect(formatLandingActivity(content)).toContain('Campaña: <script> · x=y')
    expect(formatLandingActivity(content)).not.toContain('__CN_')
    for (const compact of [true, false]) {
      const html = renderToStaticMarkup(createElement(LandingAttribution, { activities, compact }))
      expect(html).toContain('Vende tu camper')
      expect(html).toContain('Instagram')
      expect(html).toContain('&lt;script&gt;')
      expect(html).not.toContain('<script>')
      expect(html).not.toContain('__CN_')
    }
    expect(renderToStaticMarkup(createElement(LandingAttribution, { activities: [] }))).toBe('')
  })
  it('reads old system notes without rewriting them and ignores user notes or embedded markers', () => {
    const content =
      'Formulario de campaña: /encuentra-tu-camper.html\nRango: 1 o 2\nAtribución del formulario: utm_source=meta · utm_campaign=qa'
    expect(readLandingAttribution(content)).toMatchObject({
      landing: '/encuentra-tu-camper.html',
      params: { utm_source: 'meta', utm_campaign: 'qa' },
    })
    expect(formatLandingActivity(content)).toBe(content)
    expect(attributionFromActivities([{ content, agentId: 'agent' }])).toBeNull()
    expect(readLandingAttribution('Detalle libre\n' + content)).toBeNull()
  })
  it('rejects malformed snapshots, unsupported routes, control characters and oversized/free-form parameters', () => {
    for (const p of [
      { utm_campaign: 'a'.repeat(201) },
      { utm_source: 'meta\nfake' },
      { fbclid: 'qa' },
      { arbitrary: 'qa' },
      { utm_source: '' },
    ]) {
      expect(landingAttributionSchema.safeParse(p).success).toBe(false)
      for (const payload of [landingPayload(), landingBuyerPayload()]) {
        const schema =
          payload.respuestas.pagina === '/vende-tu-camper.html'
            ? landingSellerSchema
            : landingBuyerSchema
        expect(
          schema.safeParse({ ...payload, respuestas: { ...payload.respuestas, atribucion: p } })
            .success
        ).toBe(false)
      }
    }
    expect(readLandingAttribution('__CN_ATTRIBUTION_V1__{')).toBeNull()
    expect(
      readLandingAttribution('__CN_ATTRIBUTION_V1__{"version":1,"landing":"/fake","params":{}}')
    ).toBeNull()
    expect(readLandingAttribution(null)).toBeNull()
  })
  it('accepts bounded parameters in both forms and never displays unresolved ad templates', () => {
    for (const payload of [landingPayload(), landingBuyerPayload()]) {
      const schema =
        payload.respuestas.pagina === '/vende-tu-camper.html'
          ? landingSellerSchema
          : landingBuyerSchema
      expect(
        schema.safeParse({
          ...payload,
          respuestas: {
            ...payload.respuestas,
            atribucion: { utm_source: 'meta', utm_campaign: 'a'.repeat(200) },
          },
        }).success
      ).toBe(true)
    }
    const rows = landingAttributionRows({
      version: 1,
      landing: '/encuentra-tu-camper.html',
      params: { utm_source: '{{site_source_name}}', ad_id: '{{ad.id}}' },
    })
    expect(rows).toHaveLength(2)
    expect(rows[1].value).toBe('Sin etiquetas de origen')
  })
})

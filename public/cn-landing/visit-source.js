// Capture the source at entry, including visits that reach a campaign form via the home page.
;(function () {
  const storageKey = 'cn_landing_visit_v2'
  const fields = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'utm_id',
    'campaign_id',
    'adset_id',
    'ad_id',
    'placement',
    'fbclid',
  ]
  const metaSources = [
    'meta',
    'facebook',
    'fb',
    'instagram',
    'ig',
    'messenger',
    'audience_network',
    'an',
  ]
  const query = new URLSearchParams(location.search)
  function cleanParams(read) {
    const result = {}
    for (const key of fields) {
      const raw = read(key)
      if (typeof raw !== 'string') continue
      const value = raw
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, 200)
      if (value && !value.includes('{{') && !value.includes('}}')) result[key] = value
    }
    return result
  }
  let params = cleanParams((key) => query.get(key))
  let referrer
  try {
    if (document.referrer) referrer = new URL(document.referrer)
  } catch {}
  const internal = referrer?.origin === location.origin
  const host = referrer?.hostname || ''
  const otherClick = ['gclid', 'msclkid', 'ttclid'].some((key) => query.has(key))
  const tagged = fields.some((key) => query.has(key)) || otherClick
  const navigation = performance.getEntriesByType?.('navigation')?.[0]?.type
  if (!params.utm_source && !otherClick) {
    if (/(^|\.)instagram\.com$/i.test(host)) params.utm_source = 'instagram'
    else if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/i.test(host))
      params.utm_source = 'facebook'
    else if (params.fbclid) params.utm_source = 'meta'
  }
  try {
    if (
      !tagged &&
      (internal || navigation === 'reload' || navigation === 'back_forward') &&
      !params.utm_source
    ) {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}')
      params = cleanParams((key) => saved?.[key])
    }
    sessionStorage.setItem(storageKey, JSON.stringify(params))
  } catch {}
  window.CNLandingVisit = {
    params,
    fromMeta: metaSources.includes((params.utm_source || '').toLowerCase()),
  }
})()

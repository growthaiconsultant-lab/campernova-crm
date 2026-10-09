/* Consentimiento común de la web y las landings. GTM/Meta no cargan antes de aceptar. */
;(function (w) {
  if (w.CNConsent) return
  var KEY = 'cn_cookie_consent',
    EVENT = 'cn:consent'
  var choice = null,
    accepted = [],
    pending = []
  function valid(v) {
    return v === 'all' || v === 'essential' ? v : null
  }
  try {
    choice = valid(w.localStorage.getItem(KEY))
  } catch (e) {}
  w.dataLayer = w.dataLayer || []
  w.gtag =
    w.gtag ||
    function () {
      w.dataLayer.push(arguments)
    }
  function permissions() {
    var state = choice === 'all' ? 'granted' : 'denied'
    return {
      analytics_storage: state,
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
    }
  }
  w.gtag('consent', 'default', permissions())
  function apply(value) {
    choice = valid(value)
    w.gtag('consent', 'update', permissions())
    // Si el SDK aún no ha llegado, elimina eventos pendientes antes de revocar.
    if (choice !== 'all' && w.fbq && !w.fbq.callMethod && Array.isArray(w.fbq.queue)) {
      w.fbq.queue = w.fbq.queue.filter(function (args) {
        return (
          args[0] !== 'track' &&
          args[0] !== 'trackCustom' &&
          !(args[0] === 'consent' && args[1] === 'grant')
        )
      })
    }
    if (typeof w.fbq === 'function') w.fbq('consent', choice === 'all' ? 'grant' : 'revoke')
    if (choice !== 'all') {
      pending = []
      return
    }
    accepted.forEach(function (item) {
      if (item.ran) return
      item.ran = true
      item.fn()
    })
  }
  function flushMeta() {
    if (choice !== 'all' || typeof w.fbq !== 'function') return
    var jobs = pending
    pending = []
    jobs.forEach(function (args) {
      w.fbq.apply(w, args)
    })
  }
  w.CNConsent = {
    get: function () {
      return choice
    },
    isAllowed: function () {
      return choice === 'all'
    },
    set: function (value) {
      value = valid(value)
      if (!value) return
      try {
        w.localStorage.setItem(KEY, value)
      } catch (e) {}
      w.dispatchEvent(new CustomEvent(EVENT, { detail: value }))
    },
    onAccept: function (fn) {
      var item = { fn: fn, ran: false }
      accepted.push(item)
      if (choice === 'all') {
        item.ran = true
        fn()
      }
    },
    trackMeta: function () {
      if (choice !== 'all') return false
      var args = Array.prototype.slice.call(arguments)
      if (typeof w.fbq === 'function') w.fbq.apply(w, args)
      else if (pending.length < 20) pending.push(args)
      else return false
      return true
    },
    flushMeta: flushMeta,
  }
  w.addEventListener(EVENT, function (e) {
    apply(e.detail)
  })
  w.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) {
      apply(e.key === null ? null : e.newValue)
      // Sincroniza también los banners abiertos en otras pestañas.
      w.dispatchEvent(new CustomEvent('cn:consent-ui', { detail: choice }))
    }
  })
})(window)

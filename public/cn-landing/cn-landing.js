window.cnOK = true;
/* Campers Nova · landings de campaña · Nira Agency, octubre 2026
   Un solo script para las dos páginas: movimiento + formulario.

   CONFIGURACIÓN (lo único que hay que tocar):
   - endpoint: servidor de formularios de Nira.
   - crmEndpoint: entrada pública del CRM. Ambos destinos deben confirmar el envío.
   - pixel: ID del píxel de Meta de Campers Nova. Vacío = no se carga nada y no sale aviso de cookies.
   - whatsapp: número al que se abre WhatsApp después de enviar (o si el envío falla). */
var CN_CONFIG = window.CN_CONFIG || {
  endpoint: 'https://docs.niraagency.com/api/formulario/',
  crmEndpoint: '',
  pixel: '',
  whatsapp: '34645639185'
};

(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= MOVIMIENTO ================= */

  /* titulares que entran palabra a palabra (respeta <em> y <br>) */
  var idx = 0;
  function trocea(nodo) {
    [].slice.call(nodo.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/([ \t\n\r]+)/).forEach(function (p) {
          if (!p) return;
          if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var s = document.createElement('span'); s.textContent = p; s.style.setProperty('--i', idx++);
          w.appendChild(s); frag.appendChild(w);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') trocea(n);
    });
  }
  [].forEach.call(document.querySelectorAll('[data-split]'), function (el) { idx = 0; trocea(el); el.classList.add('split'); });

  /* escalonado */
  [].forEach.call(document.querySelectorAll('[data-st]'), function (p) {
    var paso = parseFloat(p.getAttribute('data-st')) || 0.08;
    [].forEach.call(p.querySelectorAll('[data-r],[data-clip]'), function (h, i) { h.style.setProperty('--d', (i * paso).toFixed(2) + 's'); });
  });

  /* aparición al hacer scroll */
  var vistos = document.querySelectorAll('[data-r],[data-clip]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    [].forEach.call(vistos, function (el) { io.observe(el); });
  } else {
    [].forEach.call(vistos, function (el) { el.classList.add('in'); });
  }

  /* vídeos: solo suenan si se pide y solo se reproducen cuando se ven */
  var videos = [].slice.call(document.querySelectorAll('video[data-auto]'));
  if ('IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.2 });
    videos.forEach(function (v) { v.muted = true; vo.observe(v); });
  }
  [].forEach.call(document.querySelectorAll('.sonido'), function (b) {
    b.addEventListener('click', function () {
      var v = b.closest('.reel').querySelector('video');
      v.muted = !v.muted;
      if (!v.muted) { try { v.currentTime = 0; } catch (e) {} var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      b.classList.toggle('activo', !v.muted);
      b.querySelector('.t').textContent = v.muted ? 'Escuchar' : 'Silenciar';
    });
  });

  /* burbuja tipo historia del hero: un toque y se oye el reel */
  [].forEach.call(document.querySelectorAll('.story'), function (b) {
    b.addEventListener('click', function () {
      var v = b.querySelector('video');
      v.muted = !v.muted;
      if (!v.muted) { try { v.currentTime = 0; } catch (e) {} var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      b.classList.toggle('activo', !v.muted);
      var s = b.querySelector('small'); if (s) s.textContent = v.muted ? (s.getAttribute('data-off') || 'Toca para escucharlo') : 'Toca para silenciar';
    });
  });

  /* WhatsApp y teléfono también son contactos: se miden como Contact en Meta */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="wa.me"],a[href^="tel:"]');
    if (a && window.fbq) window.fbq('track', 'Contact', { content_name: (document.getElementById('cn-form') || {}).getAttribute ? document.getElementById('cn-form').getAttribute('data-slug') : '' });
  });

  /* filtros de la rejilla de vehículos (como las pestañas de la plantilla) */
  [].forEach.call(document.querySelectorAll('.filtros'), function (tabs) {
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return;
      [].forEach.call(tabs.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
      var f = b.getAttribute('data-f');
      [].forEach.call(document.querySelectorAll('.grid3 .veh'), function (v) { v.classList.toggle('fuera', f !== 'todas' && v.getAttribute('data-cat') !== f); });
    });
  });

  /* notas de voz: su audio real, con la onda que avanza */
  var notas = [].slice.call(document.querySelectorAll('.vnota[data-audio]'));
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  notas.forEach(function (n) {
    var btn = n.querySelector('.nt-play'), barras = [].slice.call(n.querySelectorAll('.ondas i')), t = n.querySelector('.nt-t'), total = t.textContent, au = null;
    btn.addEventListener('click', function () {
      if (!au) {
        au = new Audio(n.getAttribute('data-audio')); au.preload = 'auto';
        au.addEventListener('timeupdate', function () {
          var p = au.duration ? au.currentTime / au.duration : 0, k = Math.round(p * barras.length);
          barras.forEach(function (b, i) { b.classList.toggle('on', i < k); });
          t.textContent = mmss(au.currentTime);
        });
        au.addEventListener('ended', function () { n.classList.remove('sonando'); barras.forEach(function (b) { b.classList.remove('on'); }); t.textContent = total; });
        n._au = au;
      }
      if (au.paused) {
        notas.forEach(function (o) { if (o !== n && o._au && !o._au.paused) { o._au.pause(); o.classList.remove('sonando'); } });
        var pr = au.play(); if (pr && pr.catch) pr.catch(function () {});
        n.classList.add('sonando');
        if (window.fbq) window.fbq('trackCustom', 'EscucharNota', { quien: n.querySelector('b').textContent });
      } else { au.pause(); n.classList.remove('sonando'); }
    });
  });

  /* historias: la barra de arriba avanza con el vídeo */
  [].forEach.call(document.querySelectorAll('.story video'), function (v) {
    var card = v.closest('.story');
    v.addEventListener('timeupdate', function () { if (v.duration) card.style.setProperty('--t', (v.currentTime / v.duration).toFixed(3)); });
  });

  /* tarjetas con reel: «Escuchar» pone el fragmento desde el principio y con sonido */
  [].forEach.call(document.querySelectorAll('.qcard'), function (c) {
    var b = c.querySelector('.escuchar'), v = c.querySelector('video');
    if (!b || !v) return;
    b.addEventListener('click', function () {
      var activo = !c.classList.contains('activo');
      [].forEach.call(document.querySelectorAll('.qcard.activo'), function (o) { if (o !== c) { o.classList.remove('activo'); var ov = o.querySelector('video'); ov.muted = true; o.querySelector('.escuchar .t').textContent = 'Escuchar'; } });
      c.classList.toggle('activo', activo);
      v.muted = !activo;
      if (activo) { try { v.currentTime = 0; } catch (er) {} var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      b.querySelector('.t').textContent = activo ? 'Silenciar' : 'Escuchar';
    });
  });

  /* cabecera: transparente sobre la foto, crema al bajar; el menú marca la sección en la que estás */
  var top = document.querySelector('.top');
  var enlaces = [].slice.call(document.querySelectorAll('.menu a'));
  var secciones = enlaces.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  /* fotos que se mueven más despacio que la página */
  var lentas = [].slice.call(document.querySelectorAll('.fi-in img, .ef-in img, .life > picture img, .cta-full > picture img'));
  /* «Cómo funciona»: la furgoneta recorre la carretera al bajar */
  var caminos = [].slice.call(document.querySelectorAll('[data-camino]'));
  var pendiente = false, ultimoY = window.scrollY;
  function pinta() {
    pendiente = false;
    var y = window.scrollY, vh = window.innerHeight;
    if (top) {
      top.classList.toggle('solid', y > 60);
      if (y > vh * 0.9 && y > ultimoY + 4) top.classList.add('oculta');
      else if (y < ultimoY - 4 || y < vh * 0.9) top.classList.remove('oculta');
    }
    ultimoY = y;
    var actual = -1;
    secciones.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < vh * 0.4) actual = i; });
    enlaces.forEach(function (a, i) { a.classList.toggle('on', i === actual); });
    if (reduce) return;
    lentas.forEach(function (im) {
      var r = im.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var v = (r.top + r.height / 2 - vh / 2) * -0.12;
      im.style.setProperty('--py', Math.max(-90, Math.min(90, v)).toFixed(1) + 'px');
    });
    caminos.forEach(function (c) {
      var r = c.getBoundingClientRect(), car = c.querySelector('.carretera'), meta = c.querySelector('.meta');
      if (car && meta) { var bd = meta.querySelector('.bandera'); var fin = meta.offsetTop + (bd ? bd.offsetTop + bd.offsetHeight / 2 : 40); c.style.setProperty('--alto', fin + 'px'); }
      var alto = car ? car.offsetHeight : r.height;
      var p = (vh * 0.55 - r.top) / alto; p = Math.max(0, Math.min(1, p));
      c.style.setProperty('--p', p.toFixed(4));
      /* cada parada: pendiente, en curso o hecha según dónde va la furgoneta */
      var furgoY = car ? 32 + (car.offsetHeight - 122) * p : 0, etapas = [].slice.call(c.querySelectorAll('.etapa')), actual = -1;
      etapas.forEach(function (e, i) { if (e.offsetTop + 44 <= furgoY + 40) actual = i; });
      var llega = p > 0.97;
      etapas.forEach(function (e, i) {
        var hecha = llega || i < actual, activa = !llega && i === actual;
        e.classList.toggle('hecha', hecha); e.classList.toggle('activa', activa); e.classList.toggle('pasada', hecha || activa);
      });
      if (meta) meta.classList.toggle('llegada', llega);
      var seg = c.parentNode.querySelector('.seguir');
      if (seg) {
        seg.style.setProperty('--p', p.toFixed(3));
        seg.querySelector('.sg-pct').textContent = Math.round(p * 100) + ' %';
        var txt = actual < 0 ? seg.getAttribute('data-ini') : llega ? seg.getAttribute('data-fin') + ' ✓' : 'Paso ' + (actual + 1) + ' de ' + seg.getAttribute('data-total') + ' · ' + etapas[actual].getAttribute('data-titulo');
        var t = seg.querySelector('.sg-txt'); if (t.textContent !== txt) t.textContent = txt;
        seg.classList.toggle('fin', llega);
      }
      var fu = c.querySelector('.furgo');
      if (fu && c._ultP !== undefined && Math.abs(c._ultP - p) > 0.001 && !llega) { fu.classList.add('moviendo'); clearTimeout(c._t); c._t = setTimeout(function () { fu.classList.remove('moviendo'); }, 220); }
      c._ultP = p;
    });
  }
  window.addEventListener('scroll', function () { if (!pendiente) { pendiente = true; requestAnimationFrame(pinta); } }, { passive: true });
  window.addEventListener('resize', pinta);
  pinta();
  if (reduce) caminos.forEach(function (c) { c.style.setProperty('--p', 1); [].forEach.call(c.querySelectorAll('.etapa'), function (e) { e.classList.add('pasada'); }); });

  /* ================= FORMULARIO ================= */
  var form = document.getElementById('cn-form');
  if (!form) return;
  var slug = form.getAttribute('data-slug');
  var waIntro = form.getAttribute('data-wa') || 'Hola Esteban, os acabo de escribir desde la web.';
  var steps = [].slice.call(form.querySelectorAll('.step'));
  var barra = form.querySelector('.bar i');
  var pasoTxt = form.querySelector('.paso-n');
  var actual = 0;
  var submission = null;
  var yearInput = form.querySelector('[name=anio]');
  if (yearInput) yearInput.max = new Date().getFullYear() + 1;

  /* de qué anuncio viene el contacto */
  var origen = {};
  var attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'campaign_id', 'adset_id', 'ad_id', 'placement'];
  var originKeys = attributionKeys.concat(['fbclid']);
  function cleanOrigin(values) {
    var clean = {};
    originKeys.forEach(function (k) {
      var v = values && values[k];
      if (typeof v !== 'string') return;
      v = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
      if (v && v.indexOf('{{') === -1 && v.indexOf('}}') === -1) clean[k] = v;
    });
    return clean;
  }
  try {
    var qs = new URLSearchParams(location.search);
    var incoming = {}, tagged = false;
    originKeys.forEach(function (k) { if (qs.has(k)) { tagged = true; incoming[k] = qs.get(k); } });
    if (tagged) {
      origen = cleanOrigin(incoming);
      try { sessionStorage.setItem('cn_attribution_v1', JSON.stringify(origen)); } catch (e) {}
    } else {
      try { origen = cleanOrigin(JSON.parse(sessionStorage.getItem('cn_attribution_v1') || '{}')); } catch (e) {}
    }
  } catch (e) {}

  function aviso(msg) { var e = steps[actual].querySelector('.err'); e.textContent = msg; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  function muestra(i) {
    var atras = i < actual;
    steps.forEach(function (s, j) { s.classList.toggle('on', j === i); s.classList.toggle('atras', j === i && atras); });
    actual = i;
    if (barra) barra.style.width = ((i + 1) / steps.length * 100) + '%';
    if (pasoTxt) pasoTxt.textContent = (i + 1);
    [].forEach.call(form.querySelectorAll('.err'), function (e) { e.classList.remove('on'); });
  }
  function falta(paso) {
    var grupos = paso.querySelectorAll('[data-req]');
    for (var i = 0; i < grupos.length; i++) {
      var g = grupos[i], radios = g.querySelectorAll('input[type=radio]');
      if (radios.length) {
        var ok = false;
        for (var r = 0; r < radios.length; r++) if (radios[r].checked) ok = true;
        if (!ok) return g.getAttribute('data-req');
      } else {
        var inp = g.querySelector('input,textarea,select');
        if (inp.type === 'checkbox' ? !inp.checked : !inp.value.trim()) return g.getAttribute('data-req');
        if (inp.type === 'tel' && inp.value.replace(/\D/g, '').length < 9) return 'Revisa el teléfono: tiene que tener al menos 9 cifras.';
        if (inp.name === 'anio' && (!/^\d{4}$/.test(inp.value) || +inp.value < 1980 || +inp.value > +inp.max)) return 'Revisa el año de matriculación.';
        if (inp.name === 'km' && (!/^(?:\d+|\d{1,3}(?:[. ,]\d{3})+)$/.test(inp.value.trim()) || +inp.value.replace(/[. ,]/g, '') > 2000000)) return 'Revisa los kilómetros aproximados.';
        if (inp.type === 'tel' && (!/^\+?[\d\s().-]+$/.test(inp.value.trim()) || inp.value.replace(/\D/g, '').length > 15)) return 'Revisa el teléfono.';
      }
    }
    return '';
  }
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (!b) return;
    e.preventDefault();
    var dest = parseInt(b.getAttribute('data-ir'), 10);
    if (dest > actual) { var f = falta(steps[actual]); if (f) { aviso(f); return; } }
    muestra(dest);
    if (form.getBoundingClientRect().top < 70) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function recoge() {
    var respuestas = {}, resumen = [];
    [].slice.call(form.querySelectorAll('[data-q]')).forEach(function (g) {
      var k = g.getAttribute('data-q'), etq = g.getAttribute('data-label') || k, v = '';
      var marcado = g.querySelector('input[type=radio]:checked');
      if (marcado) v = marcado.value;
      else { var inp = g.querySelector('input:not([type=radio]):not([type=checkbox]),textarea,select'); if (inp) v = inp.value.trim(); }
      if (v) { respuestas[k] = v; if (!g.hasAttribute('data-wa-skip')) resumen.push(etq + ': ' + v); }
    });
    var o = [];
    Object.keys(origen).forEach(function (k) { o.push(k + '=' + origen[k]); });
    respuestas.origen = o.length ? o.join(' · ').slice(0, 1500) : 'directo';
    respuestas.pagina = location.pathname;
    return { respuestas: respuestas, resumen: resumen };
  }

  function sendPending() {
    var btn = form.querySelector('button[type=submit]');
    var retry = document.getElementById('cn-retry');
    btn.disabled = true; retry.disabled = true; retry.textContent = 'Enviando…';
    var jobs = [
      { name: 'crm', url: CN_CONFIG.crmEndpoint || (slug === 'campersnova-encuentra' ? '/api/landing/encuentra-tu-camper' : '/api/landing/vende-tu-camper') },
      { name: 'nira', url: CN_CONFIG.endpoint + slug }
    ].filter(function (job) { return !submission.sent[job.name]; });
    Promise.all(jobs.map(function (job) {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      var body = Object.assign({}, submission.payload);
      if (job.name === 'crm') {
        body.gdpr_consent = true;
        body.respuestas = Object.assign({}, submission.payload.respuestas, { atribucion: submission.attribution });
      }
      return fetch(job.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify(body)
      }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
        .then(function (j) { if (j.ok !== true) throw new Error('nok'); submission.sent[job.name] = true; })
        .catch(function () {})
        .then(function () { clearTimeout(timeout); });
    })).then(function () {
      var ok = submission.sent.crm && submission.sent.nira;
      var partial = submission.sent.crm || submission.sent.nira;
      var hecho = document.getElementById('cn-done');
      form.querySelector('.cuerpo').style.display = 'none';
      hecho.querySelector('h2,h3').textContent = ok ? '¡Recibido!' : partial ? 'Falta completar el envío' : 'No se ha podido enviar';
      hecho.querySelector('p').textContent = ok
        ? submission.successText
        : partial ? 'Hemos recibido parte de tu solicitud. Pulsa Reintentar para completar el envío o escríbenos por WhatsApp con los datos ya preparados.'
        : 'Ha fallado la conexión. Puedes reintentar o mandarnos los datos por WhatsApp: el mensaje ya va escrito con lo que has puesto.';
      retry.hidden = ok; retry.disabled = false; retry.textContent = 'Reintentar envío';
      document.getElementById('cn-wa').href = submission.wa;
      hecho.classList.add('on');
      if ((submission.sent.crm || submission.sent.nira) && !submission.tracked) {
        submission.tracked = true;
        if (window.fbq) window.fbq('track', 'Lead', { content_name: slug }, { eventID: submission.eventId });
      }
      var fj = document.querySelector('.fijo'); if (fj) fj.remove();
      if (form.getBoundingClientRect().top < 70) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  document.getElementById('cn-retry').addEventListener('click', function () {
    if (submission && !this.disabled) sendPending();
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submission) return;
    for (var i = 0; i < steps.length; i++) {
      var f = falta(steps[i]);
      if (f) { muestra(i); aviso(f); return; }
    }
    var btn = form.querySelector('button[type=submit]');
    btn.querySelector('.t').textContent = 'Enviando…';
    var d = recoge();
    var nombre = ((form.querySelector('[name=nombre]') || {}).value || '').trim();
    var tel = ((form.querySelector('[name=telefono]') || {}).value || '').trim();
    var texto = waIntro + (nombre ? ' Soy ' + nombre + '.' : '') + '\n' + d.resumen.join('\n');
    var wa = 'https://wa.me/' + CN_CONFIG.whatsapp + '?text=' + encodeURIComponent(texto);
    var eventId = 'cn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    d.respuestas.event_id = eventId;

    var attribution = {};
    attributionKeys.forEach(function (k) { if (origen[k]) attribution[k] = origen[k]; });
    submission = { payload: { nombre: nombre, contacto: tel, respuestas: d.respuestas, web_url: (form.querySelector('[name=web_url]') || {}).value || '' }, attribution: attribution,
      eventId: eventId, wa: wa, sent: { crm: false, nira: false }, tracked: false,
      successText: document.getElementById('cn-done').querySelector('p').textContent };
    sendPending();
  });

  /* botón fijo en móvil: aparece cuando el formulario no está a la vista */
  var fijo = document.querySelector('.fijo');
  if (fijo && 'IntersectionObserver' in window) {
    var visto = true;
    new IntersectionObserver(function (en) { visto = en[0].isIntersecting; document.body.classList.toggle('form-visible', visto); fijo.classList.toggle('on', !visto && window.scrollY > 400); }).observe(form);
    window.addEventListener('scroll', function () { fijo.classList.toggle('on', !visto && window.scrollY > 400); }, { passive: true });
  }

  /* píxel de Meta: solo con ID y solo si aceptan cookies */
  if (CN_CONFIG.pixel) {
    var KEY = 'cn_consent';
    var cargar = function () {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CN_CONFIG.pixel);
      window.fbq('track', 'PageView');
    };
    var c = null; try { c = localStorage.getItem(KEY); } catch (e) {}
    if (c === 'si') cargar();
    else if (c !== 'no') {
      var banner = document.getElementById('cn-cookies');
      if (banner) {
        banner.classList.add('on');
        banner.addEventListener('click', function (e) {
          var b = e.target.closest('[data-consent]'); if (!b) return;
          var v = b.getAttribute('data-consent');
          try { localStorage.setItem(KEY, v); } catch (er) {}
          banner.classList.remove('on');
          if (v === 'si') cargar();
        });
      }
    }
  }
})();

/* v62 · logos de la portada: se encienden uno a uno en su color (pausa al pasar el ratón o fuera de pantalla) */
(function () {
  var row = document.querySelector('.hlogos .logos'); if (!row) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var org = [].slice.call(row.querySelectorAll('.lgc:not(.dup)')), dup = [].slice.call(row.querySelectorAll('.lgc.dup'));
  var i = -1, hov = false, vis = true;
  function off() { [].forEach.call(row.querySelectorAll('.lg-act'), function (x) { x.classList.remove('lg-act'); }); }
  row.addEventListener('mouseenter', function () { hov = true; off(); });
  row.addEventListener('mouseleave', function () { hov = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; }).observe(row);
  setInterval(function () {
    if (hov || !vis || document.hidden) return;
    off(); i = (i + 1) % org.length; org[i].classList.add('lg-act'); if (dup[i]) dup[i].classList.add('lg-act');
  }, 1100);
})();

/* v62 · pie: abierto o cerrado ahora, según el horario publicado y la hora de Barcelona */
(function () {
  var el = document.getElementById('cn-ahora'); if (!el || !window.Intl) return;
  try {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    var d = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday), m = (+p.hour % 24) * 60 + (+p.minute);
    if (d < 0) return;
    var cierre = d < 5 ? 19 : d === 5 ? 13 : 0, t1 = 'Cerrado ahora', t2;
    if (cierre && m >= 600 && m < cierre * 60) { t1 = 'Abierto ahora'; t2 = 'Hasta las ' + cierre + ':00'; el.classList.add('abierto'); }
    else if (cierre && m < 600) t2 = 'Abrimos hoy a las 10:00';
    else { var n = (d + 1) % 7; t2 = 'Abrimos ' + (n === 6 ? 'el lunes' : 'mañana') + ' a las 10:00'; }
    var tx = el.querySelector('.pie-tx'), b = document.createElement('b'), s = document.createElement('small');
    b.textContent = t1; s.textContent = t2; tx.textContent = ''; tx.appendChild(b); tx.appendChild(s); el.hidden = false;
  } catch (e) {}
})();

/* global React, CN */
const { VEHICLES, eur, km, Icon, SmartImg, VCard } = window.CN;

// =====================================================
// COMPRAR PAGE — chat-driven discovery
// =====================================================
const ComprarPage = ({ navigate }) => {
  const SYSTEM_PROMPT = `Eres el asistente de Campers Nova, una compraventa especializada en campers y autocaravanas con instalaciones en Barcelona (Carrer Torre de Cellers, 08150). Tu trabajo es entender qué busca el cliente con preguntas naturales y útiles, NO mostrar un catálogo.

Tono: cercano, experto, sin jerga. Respuestas cortas (2-4 frases). En castellano.

Tu objetivo es captar el lead con contexto rico para que el equipo (Esteban) pueda llamar/escribir con propuestas concretas. Para eso, descubre progresivamente:
1. Tipo de uso (escapadas finde / viajes largos / vivir en ella / alquiler)
2. Plazas necesarias y si duermen niños
3. Tipo de vehículo: camper compacta o autocaravana (ayúdale a decidir si dudas)
4. Presupuesto orientativo
5. Plazos (urgente / próximos meses / sin prisa)
6. Si tiene vehículo a entregar como parte del pago

Cuando tengas suficiente contexto (no fuerces si solo lleva 2 mensajes), propón el siguiente paso: "Con esto Esteban del equipo puede prepararte 2-3 opciones reales esta semana. ¿Prefieres que te llame hoy o te las paso por WhatsApp?". Pide nombre y teléfono o WhatsApp.

NUNCA inventes vehículos en stock. Si te preguntan modelos concretos, di que el equipo te confirma disponibilidad real. Habla siempre desde "nosotros" / "el equipo".`;

  const SUGGESTIONS = [
    "Soy primerizo, ayúdame a empezar",
    "Busco para escapadas de fin de semana",
    "Para familia con 2 niños",
    "Quiero estrenar antes del verano",
    "Tengo un vehículo que entregar",
  ];

  const [messages, setMessages] = React.useState([
    { role: "assistant", content: "Hola 👋 Soy el asistente de Campers Nova. Cuéntame qué buscas con tus palabras: para qué la usarías, cuántos sois, si tienes alguna idea en mente. Yo te oriento y, cuando tengamos algo claro, te paso al equipo con propuestas reales." }
  ]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollerRef = React.useRef(null);
  const taRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, sending]);

  React.useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const reply = await window.claude.complete({
        messages: [
          { role: "user", content: SYSTEM_PROMPT },
          { role: "assistant", content: "Entendido. Soy el asistente de Campers Nova y te ayudo a encontrar la camper o autocaravana que encaja contigo." },
          ...next.map(m => ({ role: m.role, content: m.content })),
        ],
      });
      setMessages(m => [...m, { role: "assistant", content: typeof reply === "string" ? reply : reply?.content || "Perdona, ahora mismo no puedo responder. ¿Te llamamos directamente al teléfono?" }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: "Perdona, se me ha cruzado un cable. ¿Prefieres que te contactemos por WhatsApp al 629 92 58 21?" }]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <section className="chat-page" data-screen-label="Comprar — Chat">
      <div className="chat-layout">

        {/* MAIN — chat */}
        <div className="chat-main">
          <div className="chat-head">
            <span className="eyebrow">· Búsqueda guiada</span>
            <h1 className="chat-h1">Cuéntanos qué buscas. Te ayudamos a encontrarlo.</h1>
            <p className="chat-sub">
              No tenemos un catálogo plano. Tenemos un equipo que escucha lo que necesitas y te propone vehículos reales que encajan contigo.
              Empieza la conversación abajo o elige una sugerencia.
            </p>
          </div>

          <div className="chat-window">
            <div className="chat-status-bar">
              <span className="dot" />
              <span>Equipo conectado · normalmente responde el mismo día</span>
            </div>

            <div className="chat-scroller" ref={scrollerRef}>
              {messages.map((m, i) => (
                <div key={i} className={`msg msg-${m.role}`}>
                  {m.role === "assistant" && (
                    <div className="msg-avatar">
                      <img src="assets/logo.png" alt="" />
                    </div>
                  )}
                  <div className="msg-bubble">{m.content}</div>
                </div>
              ))}
              {sending && (
                <div className="msg msg-assistant">
                  <div className="msg-avatar"><img src="assets/logo.png" alt="" /></div>
                  <div className="msg-bubble msg-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="chat-suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="chat-chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="chat-input-row">
              <textarea
                ref={taRef}
                rows={1}
                placeholder="Escribe lo que buscas — por ejemplo: somos pareja, queremos algo manejable para escapadas en Pirineos, presupuesto sobre 45.000 €…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={sending}
              />
              <button className="chat-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Enviar">
                <Icon name="arrow" size={18} />
              </button>
            </div>
            <p className="chat-foot">
              Al continuar, aceptas que el equipo de Campers Nova te contacte para guiarte.
              Tus datos no se comparten con terceros.
            </p>
          </div>
        </div>

        {/* SIDE — reassurance + alt channels */}
        <aside className="chat-side">
          <div className="chat-side-card">
            <div className="chat-side-head">
              <div className="chat-side-avatar">E</div>
              <div>
                <div className="chat-side-name">Esteban · Campers Nova</div>
                <div className="chat-side-role">Asesor sénior · 6 años</div>
              </div>
            </div>
            <p className="chat-side-quote">
              "Te leo en cuanto el asistente recoja lo importante. Mi trabajo es proponerte solo lo que tiene sentido para ti."
            </p>
          </div>

          <div className="chat-side-block">
            <h5>Por qué empezar por aquí</h5>
            <ul className="chat-side-list">
              <li><span className="check"><Icon name="check" size={12} /></span>Cero filtros que no entiendes</li>
              <li><span className="check"><Icon name="check" size={12} /></span>Stock real, no maquetado</li>
              <li><span className="check"><Icon name="check" size={12} /></span>Te llamamos solo cuando lo pidas</li>
              <li><span className="check"><Icon name="check" size={12} /></span>Garantía mecánica de 12 meses</li>
            </ul>
          </div>

          <div className="chat-side-block">
            <h5>¿Prefieres otro canal?</h5>
            <a href="https://wa.me/34629925821" target="_blank" rel="noopener noreferrer" className="chat-side-link">
              <Icon name="whatsapp" size={16} /> WhatsApp · 629 92 58 21
            </a>
            <a href="tel:+34629925821" className="chat-side-link">
              <Icon name="phone" size={16} /> Llamar al equipo
            </a>
            <a href="mailto:info@campersnova.com" className="chat-side-link">
              <Icon name="mail" size={16} /> info@campersnova.com
            </a>
          </div>

          <div className="chat-side-visit">
            <h5>Visítanos en Barcelona</h5>
            <p>
              <a
                href="https://www.google.com/maps/dir//CAMPERS+NOVA,+SL,+Carrer+Torre+de+Cellers,+08150,+Barcelona/@41.4089216,2.1528576,10z/data=!4m8!4m7!1m0!1m5!1m1!1s0x12a4ebf0fa3704c3:0x5219e56327ff3bb7!2m2!1d2.2429082!2d41.5648851"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--teal-900)", textDecoration: "none", borderBottom: "1px solid var(--line)" }}
              >
                Carrer Torre de Cellers · 08150 — Cómo llegar ↗
              </a>
              <br/>Lun–Vie 10:00–19:00 · Sáb 10:00–13:00
            </p>
          </div>
        </aside>

      </div>
    </section>
  );
};

// Comparison table — "Compara antes de decidir"
const CompareSection = () => {
  const Y = () => <span className="yes" aria-label="sí"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 8"/></svg></span>;
  const N = () => <span className="no" aria-label="no"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></span>;
  const P = () => <span className="partial" aria-label="parcial"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg></span>;

  const rows = [
    ["Tiempo medio de venta",             <span className="num">~42 días</span>,        <span className="num">3–6 meses</span>,        <span className="num">1–3 meses</span>],
    ["Custodia del vehículo",             "En nuestras instalaciones",                  "En tu casa / garaje",                         "En el concesionario"],
    ["Tasación profesional",              <Y/>,                                          <N/>,                                          <P/>],
    ["Filtro de compradores",             <Y/>,                                          <N/>,                                          <Y/>],
    ["Fotos profesionales",               <Y/>,                                          <N/>,                                          <Y/>],
    ["Gestión papeleo (ITP, titularidad)",<Y/>,                                          <N/>,                                          <Y/>],
    ["Precio obtenido",                   "Precio de mercado",                          "Lo que negocies",                             <span className="num">15–25% menos</span>],
    ["Coste por adelantado",              <span className="num">0 €</span>,             "Anuncios / tiempo",                           <span className="num">0 €</span>],
  ];

  return (
    <section className="section" data-screen-label="Compara">
      <div className="container" style={{ maxWidth: 1080 }}>
        <div className="text-center" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <span className="eyebrow" style={{ color: "var(--terra-500)" }}>· Por qué Campers Nova</span>
          <h2 style={{ maxWidth: "16ch" }}>Compara antes de decidir</h2>
          <p style={{ color: "var(--ink-500)", maxWidth: "52ch" }}>Sí, te cobramos un <strong style={{ color: "var(--teal-900)" }}>4%</strong>. Esto es lo que obtienes a cambio.</p>
        </div>
        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                <th className="featured">Campers Nova</th>
                <th>Wallapop / portales</th>
                <th>Concesionario</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r[0]}</td>
                  <td className="featured">{r[1]}</td>
                  <td>{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="compare-foot">Por eso solo cobramos si vendemos. Sin venta, sin comisión. Sin riesgo para ti.</p>
      </div>
    </section>
  );
};

// =====================================================
// VENDER PAGE — form
// =====================================================
const VenderPage = ({ navigate }) => {
  const [submitted, setSubmitted] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "", phone: "", email: "", brand: "", year: "", km: "", type: "Camper",
    state: "Bueno", price: "", notes: "",
  });
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (submitted) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 640, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, background: "var(--teal-700)", color: "#fff", borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 24px" }}>
            <Icon name="check" size={32} />
          </div>
          <h1>Recibido. Te llamamos en 24h.</h1>
          <p className="lede" style={{ margin: "20px auto 36px" }}>
            Hemos recibido los datos de tu vehículo. Un asesor revisará la información
            y se pondrá en contacto contigo en menos de 24 horas con una valoración inicial.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("home")}>Volver al inicio</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="page-hero" data-screen-label="Vender Hero">
        <div className="container">
          <div className="sell-page-hero">
            <div>
              <span className="eyebrow">· Vender con nosotros</span>
              <h1 style={{ marginTop: 16 }}>Vende tu camper o autocaravana con garantías, sin complicaciones.</h1>
              <p className="lede" style={{ marginTop: 24 }}>
                Valoramos tu vehículo, preparamos su presentación, gestionamos interesados
                y te acompañamos hasta el cierre de la operación.
              </p>
              <ul className="benefit-list">
                {["Valoración profesional realista", "Tu vehículo en nuestras instalaciones, listo para visitas", "Sin curiosos, sin pérdidas de tiempo en tu casa", "Pagos y trámites protegidos", "Tiempo medio de venta: ~42 días"].map((b) => (
                  <li key={b}><span className="check"><Icon name="check" size={14} /></span>{b}</li>
                ))}
              </ul>
            </div>
            <div className="img" style={{ backgroundImage: "url('assets/driver.jpg')" }} />
          </div>
        </div>
      </section>

      <CompareSection />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: 1080 }}>
          <div className="price-band">
            <h2>Tu camper o autocaravana tiene un precio justo. Descúbrelo en 60 segundos.</h2>
            <p className="sub">Empieza con una tasación gratuita. Te respondemos en 24h.</p>
            <div className="cta">
              <a href="#valoracion" className="btn btn-accent btn-lg" onClick={(e) => { e.preventDefault(); document.getElementById("valoracion")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                Calcular precio de mi vehículo <Icon name="arrow" size={16} />
              </a>
            </div>
            <p className="alt">O escríbenos a <a href="mailto:info@campersnova.com">info@campersnova.com</a></p>
          </div>
        </div>
      </section>

      <section className="section" id="valoracion" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: 920 }}>
        </div>
      </section>
    </>
  );
};

// =====================================================
// VEHICLE DETAIL PAGE
// =====================================================
const DetallePage = ({ navigate, vehicleId }) => {
  const v = VEHICLES.find(v => v.id === vehicleId) || VEHICLES[0];
  const equipment = [
    "Techo elevable", "Cocina con dos fuegos", "Nevera de compresor",
    "Cama trasera fija", "Baño con ducha", "Calefacción estacionaria",
    "Agua: 100L limpia / 90L gris", "Panel solar 150W", "Toldo lateral",
    "Cargador USB y 220V", "Mosquiteras", "Asientos giratorios",
  ];

  return (
    <>
      <section className="section-tight" style={{ paddingTop: 32 }}>
        <div className="container">
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--ink-500)", marginBottom: 24, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate("home"); }}>Inicio</a>
            <span>/</span>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate("comprar"); }}>Comprar</a>
            <span>/</span>
            <span style={{ color: "var(--teal-900)" }}>{v.title}</span>
          </div>

          <div className="detail-gallery">
            <div className="main"><div className="img-placeholder"><span>{v.placeholder}</span></div></div>
            <div className="stack">
              <div className="thumb"><div className="img-placeholder"><span>Interior</span></div></div>
              <div className="thumb more"><div className="img-placeholder"><span>Detalle motor</span></div></div>
            </div>
          </div>

          <div className="detail-layout">
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {v.tags.map((t) => <span key={t} className="tag tag-success">{t}</span>)}
                <span className="tag" style={{ background: "transparent" }}><Icon name="pin" size={12} />{v.location}</span>
              </div>
              <h1>{v.title}</h1>
              <p className="lede" style={{ marginTop: 20 }}>{v.highlight}</p>

              <div style={{ marginTop: 48 }}>
                <h3 style={{ fontSize: 24 }}>Ficha técnica</h3>
                <div className="detail-spec-grid" style={{ marginTop: 24 }}>
                  <div className="detail-spec"><div><div className="lab">Año</div><div className="val">{v.year}</div></div></div>
                  <div className="detail-spec"><div><div className="lab">Kilómetros</div><div className="val">{km(v.km)}</div></div></div>
                  <div className="detail-spec"><div><div className="lab">Combustible</div><div className="val">{v.fuel}</div></div></div>
                  <div className="detail-spec"><div><div className="lab">Cambio</div><div className="val">{v.transmission}</div></div></div>
                  <div className="detail-spec"><div><div className="lab">Plazas viaje</div><div className="val">{v.seats}</div></div></div>
                  <div className="detail-spec"><div><div className="lab">Plazas dormir</div><div className="val">{v.sleeps}</div></div></div>
                  <div className="detail-spec"><div><div className="lab">Tipo</div><div className="val">{v.type}</div></div></div>
                  <div className="detail-spec"><div><div className="lab">Ubicación</div><div className="val">{v.location}</div></div></div>
                </div>
              </div>

              <div style={{ marginTop: 56 }}>
                <h3 style={{ fontSize: 24 }}>Equipamiento</h3>
                <ul className="equipment-grid" style={{ padding: 0, marginTop: 24 }}>
                  {equipment.map((e) => (
                    <li key={e}><Icon name="check" size={16} />{e}</li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: 56, padding: 28, background: "var(--cream-50)", borderRadius: 16, border: "1px solid var(--line)" }}>
                <span className="eyebrow">· Garantía Campers Nova</span>
                <h3 style={{ fontSize: 22, marginTop: 12 }}>Comprar con tranquilidad</h3>
                <ul className="benefit-list" style={{ marginTop: 18 }}>
                  <li><span className="check"><Icon name="check" size={14} /></span>Vehículo revisado por mecánico independiente</li>
                  <li><span className="check"><Icon name="check" size={14} /></span>Documentación completa y kilometraje verificado</li>
                  <li><span className="check"><Icon name="check" size={14} /></span>Asesoramiento durante y después de la compra</li>
                  <li><span className="check"><Icon name="check" size={14} /></span>Gestión de transferencia incluida</li>
                </ul>
              </div>
            </div>

            <aside className="detail-side">
              <div className="price">{eur(v.price)}</div>
              <div className="price-sub">Precio total · IVA incluido</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
                <button className="btn btn-primary" style={{ width: "100%" }}>Solicitar información</button>
                <button className="btn btn-ghost" style={{ width: "100%" }}>Agendar visita</button>
                <button className="btn btn-link" style={{ width: "fit-content", margin: "8px auto 0" }}>
                  <Icon name="phone" size={14} /> +34 612 345 678
                </button>
              </div>
              <div style={{ marginTop: 28, padding: "20px 0 0", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--ink-700)" }}>
                  <Icon name="shield" size={18} style={{ color: "var(--teal-700)", flexShrink: 0 }} />
                  Vehículo revisado y documentado
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--ink-700)" }}>
                  <Icon name="eye" size={18} style={{ color: "var(--teal-700)", flexShrink: 0 }} />
                  Visita presencial sin compromiso
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--ink-700)" }}>
                  <Icon name="handshake" size={18} style={{ color: "var(--teal-700)", flexShrink: 0 }} />
                  Trámites de transferencia incluidos
                </div>
              </div>
              <div className="nova-side-badge">
                <div className="ns-icon"><Icon name="sparkles" size={18} /></div>
                <div className="ns-text">
                  <strong>Nova Assistant incluido</strong>
                  <span>QR único en tu camper o autocaravana. Pregúntale a tu vehículo lo que necesites, 24/7.</span>
                  <span className="ns-tag">· Gratis · Para siempre</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
};

// =====================================================
// CÓMO FUNCIONA, SOBRE, CONTACTO — short pages
// =====================================================
const ComoFuncionaPage = ({ navigate }) => (
  <>
    <section className="page-hero">
      <div className="container">
        <span className="eyebrow">· Cómo funciona</span>
        <h1 style={{ marginTop: 16 }}>Un proceso claro de principio a fin.</h1>
        <p className="lede">Sin sorpresas, sin presión, sin gestiones por tu cuenta. Te enseñamos cómo trabajamos en cada lado de la operación.</p>
      </div>
    </section>
    <section className="section">
      <div className="container">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          {[
            { t: "Si quieres comprar", c: "var(--teal-700)", steps: [
              { n: "01", l: "Empieza la conversación", d: "Cuéntanos qué buscas con tus palabras. El asistente te orienta sin filtros confusos." },
              { n: "02", l: "Te llama el equipo", d: "Esteban te contacta con 2-3 vehículos reales que encajan contigo." },
              { n: "03", l: "Visita y prueba", d: "Te enseñamos los vehículos en nuestras instalaciones. Prueba dinámica incluida." },
              { n: "04", l: "Cierre con seguridad", d: "Tramitamos transferencia, contrato y entrega." },
            ]},
            { t: "Si quieres vender", c: "var(--terra-500)", steps: [
              { n: "01", l: "Cuéntanos tu vehículo", d: "Formulario rápido con datos y fotos." },
              { n: "02", l: "Valoración honesta", d: "Estudio de mercado y precio realista en 24h." },
              { n: "03", l: "Depósito en nuestras instalaciones", d: "Nos dejas tu camper o autocaravana. Reportaje profesional y exposición a compradores serios." },
              { n: "04", l: "Cierre y pago seguro", d: "Filtramos, negociamos y firmamos por ti." },
            ]},
          ].map(col => (
            <div key={col.t}>
              <h3 style={{ color: col.c }}>{col.t}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
                {col.steps.map(s => (
                  <div key={s.n} className="step" style={{ flexDirection: "row", alignItems: "flex-start", gap: 20 }}>
                    <div className="step-num" style={{ fontSize: 32, color: col.c }}>{s.n}</div>
                    <div>
                      <h4>{s.l}</h4>
                      <p>{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  </>
);

const SobrePage = ({ navigate }) => (
  <>
    <section className="page-hero">
      <div className="container">
        <span className="eyebrow">· Sobre nosotros</span>
        <h1 style={{ marginTop: 16 }}>Nacimos viajando. Trabajamos para que viajes mejor.</h1>
        <p className="lede">
          Campers Nova nació en 2019 de la unión entre apasionados del mundo camper y autocaravana y profesionales de la
          compraventa. Trabajamos desde nuestras instalaciones en Barcelona (Carrer Torre de Cellers, 08150),
          con cobertura para clientes de toda España.
        </p>
      </div>
    </section>
    <section className="section">
      <div className="container">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div className="sell-img" style={{ backgroundImage: "url('assets/instalaciones.jpg')", aspectRatio: "4/5" }} />
          <div>
            <h2>Lo que nos mueve</h2>
            <p className="lede" style={{ marginTop: 20 }}>
              Creemos que comprar o vender una camper o autocaravana es mucho más que cerrar una operación.
              Es abrir o cerrar una etapa de viaje. Por eso ponemos cuidado en los pequeños detalles
              y honestidad en los grandes.
            </p>
              <ul className="benefit-list">
                <li><span className="check"><Icon name="check" size={14} /></span>+240 operaciones cerradas desde 2019</li>
                <li><span className="check"><Icon name="check" size={14} /></span>4,6 ★ con 36 reseñas verificadas en Google</li>
                <li><span className="check"><Icon name="check" size={14} /></span>Equipo propio de mecánicos colaboradores</li>
                <li><span className="check"><Icon name="check" size={14} /></span>Instalaciones propias en Barcelona, custodia incluida</li>
                <li><span className="check"><Icon name="check" size={14} /></span>Asesoría legal y fiscal especializada en campers y autocaravanas</li>
              </ul>
          </div>
        </div>
      </div>
    </section>
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="visit-block">
          <div className="visit-text">
            <span className="eyebrow" style={{ color: "var(--terra-500)" }}>· Visítanos</span>
            <h2 style={{ marginTop: 16 }}>Pásate por la nave. Te enseñamos el stock.</h2>
            <p className="lede" style={{ marginTop: 20 }}>
              Nuestras instalaciones de Barcelona están abiertas para que puedas ver, tocar y probar
              cualquier vehículo del catálogo. Sin presión, con un café delante.
            </p>
            <div className="visit-info">
              <div>
                <h5>Dirección</h5>
                <p>Carrer Torre de Cellers<br/>08150 Barcelona</p>
              </div>
              <div>
                <h5>Horario</h5>
                <p>Lun – Vie · 10:00 – 19:00<br/>Sábado · 10:00 – 13:00<br/>Domingo · cerrado</p>
              </div>
              <div>
                <h5>Contacto</h5>
                <p><a href="tel:+34629925821">629 92 58 21</a><br/><a href="mailto:info@campersnova.com">info@campersnova.com</a></p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <a
                href="https://www.google.com/maps/dir//CAMPERS+NOVA,+SL,+Carrer+Torre+de+Cellers,+08150,+Barcelona/@41.4089216,2.1528576,10z/data=!4m8!4m7!1m0!1m5!1m1!1s0x12a4ebf0fa3704c3:0x5219e56327ff3bb7!2m2!1d2.2429082!2d41.5648851"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Cómo llegar <Icon name="arrow" size={16} />
              </a>
              <button className="btn btn-ghost">Agendar visita</button>
            </div>
          </div>
          <div className="visit-img" style={{ backgroundImage: "url('assets/instalaciones.jpg')" }} />
        </div>
      </div>
    </section>
  </>
);
window.ComprarPage = ComprarPage;
window.VenderPage = VenderPage;
window.DetallePage = DetallePage;
window.ComoFuncionaPage = ComoFuncionaPage;
window.SobrePage = SobrePage;

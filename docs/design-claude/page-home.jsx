/* global React, CN */
const { VEHICLES, eur, km, Icon, SmartImg, VCard } = window.CN;

// =====================================================
// HOME PAGE
// =====================================================
const HomePage = ({ navigate, tweaks }) => {
  const [favs, setFavs] = React.useState(new Set());
  const [stepsTab, setStepsTab] = React.useState("comprar");
  const toggleFav = (id) => setFavs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const heroImg = tweaks.heroImage === "couple" ? "assets/sunset-couple.png"
                : tweaks.heroImage === "window" ? "assets/sunset-window.png"
                : "assets/vw-bus.jpg";

  const trustItems = [
    { icon: "shield",   title: "Vehículos revisados",      text: "Cada camper o autocaravana pasa por una revisión técnica antes de publicarse." },
    { icon: "sparkles", title: "Asesoramiento experto",    text: "Te ayudamos a elegir según tu forma de viajar, no solo a vender." },
    { icon: "handshake",title: "Gestión profesional",      text: "Nos ocupamos de papeleo, transferencias y trámites." },
    { icon: "leaf",     title: "Proceso transparente",     text: "Sin letra pequeña, sin presión. Información clara desde el primer contacto." },
  ];

  const compraSteps = [
    { n: "01", t: "Cuéntanos",      d: "Empieza la conversación describiendo qué buscas. Sin filtros ni formularios eternos." },
    { n: "02", t: "Te orientamos",  d: "El asistente afina contigo y te conecta con Esteban del equipo cuando esté claro." },
    { n: "03", t: "Propuestas",     d: "Recibes 2-3 vehículos reales que encajan, por WhatsApp o llamada." },
    { n: "04", t: "Visita y cierre", d: "Visita en nuestras instalaciones, prueba dinámica y trámites cubiertos." },
  ];
  const ventaSteps = [
    { n: "01", t: "Cuéntanos",      d: "Envíanos los datos y fotos de tu vehículo en 5 minutos." },
    { n: "02", t: "Valoración",     d: "Estudiamos tu camper o autocaravana y te damos un precio realista de mercado." },
    { n: "03", t: "Depósito en instalaciones", d: "Nos dejas tu vehículo en nuestras instalaciones. Lo preparamos, fotografiamos y mostramos a compradores serios por ti." },
    { n: "04", t: "Cierre",         d: "Acompañamos hasta la firma con todos los trámites cubiertos." },
  ];
  const steps = stepsTab === "comprar" ? compraSteps : ventaSteps;

  const pillars = [
    { n: "01", t: "Especialistas en camper y autocaravana",    d: "Llevamos años viviendo y revendiendo el sector. Conocemos cada modelo, marca y particularidad." },
    { n: "02", t: "Trato cercano",          d: "Te atiende una persona, no un call center. Sin guiones, sin prisa." },
    { n: "03", t: "Selección cuidada",      d: "No publicamos cualquier vehículo. Filtramos por estado, historial y honestidad del propietario." },
    { n: "04", t: "Transparencia total",    d: "Documentación, kilometraje real y estado mecánico declarado por escrito." },
    { n: "05", t: "Acompañamiento real",    d: "Antes, durante y después. También cuando ya estás en la carretera." },
    { n: "06", t: "Seguridad jurídica",     d: "Contratos revisados, transferencias gestionadas y pagos protegidos." },
  ];

  return (
    <>
      {/* HERO */}
      <section className="hero" data-screen-label="01 Hero">
        <div className="hero-img" style={{ backgroundImage: `url('${heroImg}')` }} />
        <div className="hero-grad" />
        <div className="container hero-content">
          <span className="eyebrow" style={{ color: "rgba(255,255,255,0.85)" }}>· Compraventa de campers y autocaravanas</span>
          <h1 style={{ marginTop: 18 }}>Compra o vende tu camper o autocaravana con confianza y alma viajera.</h1>
          <p className="lede">
            En Campers Nova conectamos personas que quieren vivir la carretera con propietarios
            que quieren vender su camper o autocaravana de forma segura, profesional y transparente.
          </p>
          <div className="hero-cta">
            <button className="btn btn-accent btn-lg" onClick={() => navigate("comprar")}>
              Empezar conversación <Icon name="arrow" size={18} />
            </button>
            <button className="btn btn-light btn-lg" onClick={() => navigate("vender")}>
              Quiero vender mi vehículo
            </button>
          </div>
        </div>
        <div className="hero-meta">
          <span className="pill">⭐ 4,6 · 36 reseñas en Google</span>
          <span className="pill">· Barcelona · Custodia en instalaciones</span>
        </div>
      </section>

      {/* TRUST STRIP */}
      <div className="container">
        <div className="trust-strip">
          {trustItems.map((it) => (
            <div className="trust-item" key={it.title}>
              <div className="ti-icon"><Icon name={it.icon} size={20} /></div>
              <div>
                <h4>{it.title}</h4>
                <p>{it.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TWO ROUTES */}
      <section className="section" data-screen-label="02 Routes">
        <div className="container">
          <div className="section-header">
            <div>
              <span className="eyebrow">· Dos caminos, un mismo cuidado</span>
              <h2 style={{ marginTop: 14 }}>¿Empiezas un viaje o cierras uno?</h2>
            </div>
            <p>Elige tu ruta. Cada lado tiene un proceso pensado para que avances sin complicaciones, con la seguridad y el acompañamiento que mereces.</p>
          </div>
          <div className="routes">
            <div className="route" onClick={() => navigate("comprar")}>
              <div className="route-bg" style={{ backgroundImage: "url('assets/sunset-window.png')" }} />
              <div className="route-grad" />
              <div className="route-content">
                <span className="tag tag-warm" style={{ background: "rgba(194,106,74,0.95)", color: "#fff", borderColor: "transparent" }}>Comprar</span>
                <h3 style={{ marginTop: 18 }}>Encuentra tu próxima camper o autocaravana</h3>
                <p>Cuéntanos qué buscas con tus palabras. Te proponemos vehículos reales que encajan contigo, sin filtros ni catálogos eternos.</p>
                <div className="route-arrow">Empezar conversación <Icon name="arrow" size={16} /></div>
              </div>
            </div>
            <div className="route" onClick={() => navigate("vender")}>
              <div className="route-bg" style={{ backgroundImage: "url('assets/sunset-couple.png')" }} />
              <div className="route-grad" />
              <div className="route-content">
                <span className="tag" style={{ background: "rgba(245,240,230,0.95)", color: "var(--teal-900)", borderColor: "transparent" }}>Vender</span>
                <h3 style={{ marginTop: 18 }}>Vende sin complicaciones</h3>
                <p>Valoración profesional, gestión de interesados y acompañamiento hasta el cierre. Tú ganas tranquilidad.</p>
                <div className="route-arrow">Empezar valoración <Icon name="arrow" size={16} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH METHOD */}
      <section className="section" style={{ paddingTop: 0 }} data-screen-label="03 Búsqueda guiada">
        <div className="container">
          <div className="section-header">
            <div>
              <span className="eyebrow">· Búsqueda guiada</span>
              <h2 style={{ marginTop: 14 }}>No buscamos por filtros. Buscamos por conversación.</h2>
            </div>
            <div>
              <p>Olvídate de chequear casillas y comparar fichas que parecen iguales. Nos cuentas qué buscas con tus palabras y proponemos vehículos reales que encajan contigo.</p>
              <button className="btn btn-accent mt-24" onClick={() => navigate("comprar")} style={{ marginTop: 20 }}>
                Empezar conversación <Icon name="arrow" size={16} />
              </button>
            </div>
          </div>

          <div className="search-method-grid">
            <div className="method-step">
              <span className="method-num">01</span>
              <h4>Cuéntanos con tus palabras</h4>
              <p>"Somos pareja, queremos algo manejable para escapadas en Pirineos, presupuesto sobre 45.000 €". Sin formularios eternos.</p>
            </div>
            <div className="method-step">
              <span className="method-num">02</span>
              <h4>Te orientamos con preguntas útiles</h4>
              <p>El asistente afina contigo el tipo de viaje, las plazas reales que necesitas y los plazos. Sin presión, sin venta forzada.</p>
            </div>
            <div className="method-step">
              <span className="method-num">03</span>
              <h4>El equipo te llama con propuestas</h4>
              <p>Cuando tenemos lo importante, Esteban del equipo te pasa 2-3 vehículos reales que tenemos o podemos traer. Por WhatsApp o llamada, tú eliges.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SELL BLOCK */}
      <section className="section" style={{ background: "var(--cream-50)" }} data-screen-label="04 Sell">
        <div className="container">
          <div className="sell-block">
            <div className="sell-img" style={{ backgroundImage: "url('assets/driver.jpg')" }}>
              <div className="sell-img-stat">
                <div className="stat"><span className="v">42 días</span><span className="l">tiempo medio de venta</span></div>
                <div className="stat"><span className="v">98%</span><span className="l">operaciones cerradas</span></div>
              </div>
            </div>
            <div>
              <span className="eyebrow">· Para vendedores</span>
              <h2 style={{ marginTop: 14 }}>Vende tu camper o autocaravana con garantías, sin perder tiempo.</h2>
              <p className="lede" style={{ marginTop: 20 }}>
                Te acompañamos en todo el proceso: valoración, publicación, gestión de interesados,
                negociación y cierre. Tú ganas tranquilidad; nosotros nos encargamos del proceso.
              </p>
              <ul className="benefit-list">
                {["Valoración profesional realista", "Tu vehículo expuesto en nuestras instalaciones", "Publicación optimizada y reportaje profesional", "Filtrado y gestión de compradores serios", "Acompañamiento hasta la firma", "Pagos y trámites protegidos"].map((b) => (
                  <li key={b}><span className="check"><Icon name="check" size={14} /></span>{b}</li>
                ))}
              </ul>
              <div className="hero-cta" style={{ marginTop: 36 }}>
                <button className="btn btn-primary btn-lg" onClick={() => navigate("vender")}>
                  Quiero vender mi vehículo <Icon name="arrow" size={16} />
                </button>
                <button className="btn btn-link" onClick={() => navigate("como-funciona")}>Ver el proceso paso a paso</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NOVA ASSISTANT */}
      <section className="section" data-screen-label="05 Nova Assistant">
        <div className="container">
          <div className="nova-assistant">
            <div className="nova-assistant-copy">
              <span className="free-badge">
                <span className="dot"><Icon name="sparkles" size={11} /></span>
                Incluido gratis · Exclusivo Campers Nova
              </span>
              <h2>Nova Assistant: tu vehículo te responde.</h2>
              <p className="lede">
                Cada camper o autocaravana que vendemos lleva un código QR único. Escanéalo y abre un chat
                con tu vehículo: una IA que conoce tu modelo, su equipamiento y su manual.
                Pregúntale lo que necesites — desde cómo encender la calefacción hasta qué hacer
                si salta un testigo en la carretera.
              </p>
              <ul className="features">
                <li><span className="ic"><Icon name="sparkles" size={14} /></span>Resuelve dudas técnicas en segundos, sin buscar manuales.</li>
                <li><span className="ic"><Icon name="shield" size={14} /></span>Disponible 24/7, también cuando estás lejos de cobertura humana.</li>
                <li><span className="ic"><Icon name="leaf" size={14} /></span>Aprende de tu vehículo: historial, mantenimientos y consejos personalizados.</li>
                <li><span className="ic"><Icon name="handshake" size={14} /></span>Para siempre tuyo. Sin suscripciones, sin coste oculto.</li>
              </ul>
              <div className="cta-row">
                <button className="btn btn-accent btn-lg" onClick={() => navigate("comprar")}>
                  Empezar búsqueda guiada <Icon name="arrow" size={16} />
                </button>
                <button className="btn btn-link" style={{ color: "#f5d4c2" }}>Cómo funciona</button>
              </div>
            </div>

            <div className="nova-mock">
              <div className="nova-chat">
                <div className="nova-chat-head">
                  <div className="nova-chat-avatar">N</div>
                  <div>
                    <div className="name">Nova · tu California Coast</div>
                    <div className="status">En línea · responde en segundos</div>
                  </div>
                </div>
                <div className="nova-chat-body">
                  <div className="nova-msg user">¿Cómo enciendo la calefacción estacionaria?</div>
                  <div className="nova-msg bot">
                    Pulsa el botón con el símbolo de llama en el panel del techo durante 2 segundos.
                    Selecciona temperatura con la rueda. Tarda unos 5 min en arrancar 🔥
                  </div>
                  <div className="nova-msg user">Me ha saltado un testigo amarillo de aceite</div>
                  <div className="nova-msg bot">
                    <div className="nova-typing"><span></span><span></span><span></span></div>
                  </div>
                </div>
              </div>
              <div className="nova-qr" aria-hidden="true">
                <div className="qr-img"></div>
                <div className="qr-label">Escanéame<br/>en tu vehículo</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" data-screen-label="06 How it works">
        <div className="container">
          <div className="text-center" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <span className="eyebrow">· Cómo funciona</span>
            <h2 style={{ maxWidth: "20ch" }}>Un proceso pensado para los dos lados de la operación.</h2>
            <div className="steps-tabs" style={{ marginTop: 20 }}>
              <button className={`steps-tab ${stepsTab==="comprar"?"active":""}`} onClick={() => setStepsTab("comprar")}>Para comprar</button>
              <button className={`steps-tab ${stepsTab==="vender"?"active":""}`} onClick={() => setStepsTab("vender")}>Para vender</button>
            </div>
          </div>
          <div className="steps-grid">
            {steps.map((s) => (
              <div className="step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US PILLARS */}
      <section className="section" style={{ paddingTop: 0 }} data-screen-label="06 Why">
        <div className="container">
          <div className="section-header">
            <div>
              <span className="eyebrow">· Por qué Campers Nova</span>
              <h2 style={{ marginTop: 14 }}>No somos solo un escaparate de vehículos.</h2>
            </div>
            <p>
              Somos un punto de encuentro entre personas que quieren viajar mejor y propietarios
              que quieren vender con tranquilidad. Esa es la diferencia que se nota desde la primera llamada.
            </p>
          </div>
          <div className="pillars">
            {pillars.map((p) => (
              <div className="pillar" key={p.n}>
                <span className="num">{p.n}</span>
                <h4>{p.t}</h4>
                <p>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSPIRATION */}
      <section className="section" style={{ paddingTop: 0 }} data-screen-label="07 Inspiration">
        <div className="container">
          <div className="inspiration">
            <div className="inspiration-bg" style={{ backgroundImage: "url('assets/sunset-couple.png')" }} />
            <div className="inspiration-grad" />
            <div className="inspiration-content">
              <span className="eyebrow" style={{ color: "rgba(255,255,255,0.85)" }}>· Lifestyle</span>
              <h2 style={{ marginTop: 16 }}>La carretera empieza mucho antes de arrancar el motor.</h2>
              <p className="lede">
                Empieza cuando decides que quieres viajar diferente, dormir donde el paisaje lo merece
                y tener la libertad de cambiar de plan cuando quieras. En Campers Nova te ayudamos
                a dar ese paso con seguridad.
              </p>
              <button className="btn btn-light btn-lg" style={{ marginTop: 28 }} onClick={() => navigate("comprar")}>
                Empezar la conversación <Icon name="arrow" size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PODCAST */}
      <section className="section" style={{ paddingTop: 0 }} data-screen-label="08 Podcast">
        <div className="container">
          <div className="podcast-block">
            <div className="podcast-img" style={{ backgroundImage: "url('assets/podcast-studio.jpg')" }}>
              <span className="podcast-onair podcast-soon">● PRÓXIMAMENTE</span>
            </div>
            <div className="podcast-text">
              <span className="eyebrow" style={{ color: "var(--terra-500)" }}>· Campers Nova Podcasts</span>
              <h2 style={{ marginTop: 16 }}>Estamos preparando algo. Y queremos que estés.</h2>
              <p className="lede" style={{ marginTop: 20 }}>
                Desde nuestras instalaciones grabamos charlas con viajeros, mecánicos, fabricantes y rutas
                que merecen contarse. Lanzamos pronto y lo anunciaremos en Instagram.
              </p>
              <a
                href="https://www.instagram.com/campersnova/"
                target="_blank"
                rel="noopener noreferrer"
                className="ig-card"
              >
                <div className="ig-card-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/>
                  </svg>
                </div>
                <div className="ig-card-text">
                  <span className="ig-card-handle">@campersnova</span>
                  <span className="ig-card-sub">Síguenos para enterarte el primero del lanzamiento</span>
                </div>
                <Icon name="arrow" size={18} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section" style={{ paddingTop: 0 }} data-screen-label="09 Testimonios">
        <div className="container">
          <div className="section-header">
            <div>
              <span className="eyebrow">· Quien ya viaja con nosotros</span>
              <h2 style={{ marginTop: 14 }}>Historias reales, viajes que empiezan o terminan bien.</h2>
            </div>
          </div>
          <div className="testimonials">
            {[
              { q: "Vendimos nuestra furgo en tres semanas. Nos quitaron de encima la parte que más pereza nos daba: las visitas y los curiosos. Profesionales de verdad.", n: "Marta & Carlos", m: "Vendieron una VW T6 · Bilbao" },
              { q: "Buscábamos nuestra primera camper sin saber muy bien por dónde empezar. Nos asesoraron sin presión y acabamos comprando con la tranquilidad de que era la correcta.", n: "Lucía Reverte", m: "Compró una Ford Nugget · Valencia" },
              { q: "El trato cercano marca la diferencia. Te atiende siempre la misma persona y notas que conocen el mundo camper y autocaravana de verdad, no solo el papeleo.", n: "Iñaki Ferrer", m: "Vendió una Knaus Boxstar · Madrid" },
            ].map((t, i) => (
              <div className="testimonial" key={i}>
                <div className="stars">
                  {[...Array(5)].map((_,k)=><Icon key={k} name="star" size={14} />)}
                </div>
                <p className="quote">"{t.q}"</p>
                <div className="testimonial-foot">
                  <div className="testimonial-avatar">{t.n[0]}</div>
                  <div>
                    <div className="testimonial-name">{t.n}</div>
                    <div className="testimonial-meta">{t.m}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section-tight" data-screen-label="09 Final CTA">
        <div className="container">
          <div className="final-cta">
            <span className="eyebrow" style={{ color: "var(--sand-300)" }}>· Próximo paso</span>
            <h2 style={{ marginTop: 16 }}>¿Estás pensando en comprar o vender una camper o autocaravana?</h2>
            <p>Cuéntanos qué necesitas y te ayudamos a dar el siguiente paso con seguridad, claridad y confianza.</p>
            <div className="final-cta-buttons">
              <button className="btn btn-accent btn-lg" onClick={() => navigate("comprar")}>Quiero comprar</button>
              <button className="btn btn-light btn-lg" onClick={() => navigate("vender")}>Quiero vender</button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

window.HomePage = HomePage;

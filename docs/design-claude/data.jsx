/* global React */
// Shared data + small UI atoms used across pages.

const VEHICLES = [
  {
    id: "vw-cali-coast",
    title: "Volkswagen California Coast",
    year: 2022,
    km: 38500,
    seats: 4,
    sleeps: 4,
    fuel: "Diesel",
    transmission: "Automático",
    type: "Camper",
    price: 64900,
    location: "Madrid",
    tags: ["Revisada", "Ideal parejas"],
    highlight: "Una camper compacta y polivalente, perfecta para descubrir Europa sin renunciar a la comodidad del día a día.",
    placeholder: "VW California — exterior",
  },
  {
    id: "fiat-ducato-globe",
    title: "Fiat Ducato Globe-Traveller",
    year: 2021,
    km: 52100,
    seats: 4,
    sleeps: 4,
    fuel: "Diesel",
    transmission: "Manual",
    type: "Autocaravana",
    price: 58500,
    location: "Barcelona",
    tags: ["Nueva entrada", "Ideal familia"],
    highlight: "Camperizada artesanalmente con maderas claras y baño completo. Lista para largas estancias.",
    placeholder: "Ducato — interior + exterior",
  },
  {
    id: "mercedes-marco-polo",
    title: "Mercedes-Benz Marco Polo",
    year: 2023,
    km: 21900,
    seats: 4,
    sleeps: 4,
    fuel: "Diesel",
    transmission: "Automático",
    type: "Camper",
    price: 79500,
    location: "Valencia",
    tags: ["Premium", "Revisada"],
    highlight: "Acabados de gama alta, techo elevable eléctrico y todos los extras de fábrica.",
    placeholder: "Marco Polo — frontal",
  },
  {
    id: "renault-trafic-spaceclass",
    title: "Renault Trafic SpaceClass",
    year: 2020,
    km: 71200,
    seats: 5,
    sleeps: 2,
    fuel: "Diesel",
    transmission: "Manual",
    type: "Camper",
    price: 32400,
    location: "Sevilla",
    tags: ["Buen precio"],
    highlight: "Una entrada al mundo camper sensata y fiable. Perfecta para escapadas de fin de semana.",
    placeholder: "Renault Trafic — lateral",
  },
  {
    id: "ford-transit-nugget",
    title: "Ford Transit Nugget",
    year: 2022,
    km: 44600,
    seats: 4,
    sleeps: 4,
    fuel: "Diesel",
    transmission: "Automático",
    type: "Camper",
    price: 56900,
    location: "Bilbao",
    tags: ["Revisada", "Ideal parejas"],
    highlight: "Cocina amplia con módulo Westfalia, calefacción estacionaria y techo elevable.",
    placeholder: "Ford Nugget — campsite",
  },
  {
    id: "knaus-boxstar",
    title: "Knaus Boxstar 600 Lifetime",
    year: 2023,
    km: 12400,
    seats: 4,
    sleeps: 2,
    fuel: "Diesel",
    transmission: "Manual",
    type: "Autocaravana",
    price: 71500,
    location: "Madrid",
    tags: ["Casi nueva", "Premium"],
    highlight: "Furgoneta camper de gama alta, cama transversal y baño separado con plato de ducha.",
    placeholder: "Knaus Boxstar — exterior",
  },
];

const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const km = (n) => new Intl.NumberFormat("es-ES").format(n) + " km";

// ---- Icons (line, 1.6 stroke) ----
const Icon = ({ name, size = 20, ...rest }) => {
  const paths = {
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"/></>,
    sparkles: <><path d="M12 4l1.5 4 4 1.5-4 1.5L12 15l-1.5-4-4-1.5 4-1.5L12 4z"/><path d="M19 14l.7 1.8L21.5 16.5 19.7 17.2 19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z"/></>,
    handshake: <><path d="M12 11l-2-2-3 3 5 5 5-5-3-3-2 2z"/><path d="M3 12l4-4 5 5"/><path d="M21 12l-4-4"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></>,
    bed: <><path d="M3 18V8"/><path d="M3 12h18v6"/><path d="M21 18V12"/><circle cx="7" cy="13.5" r="1.5"/></>,
    seats: <><path d="M5 18h14"/><path d="M7 18v-3a3 3 0 013-3h4a3 3 0 013 3v3"/><circle cx="12" cy="6" r="3"/></>,
    fuel: <><path d="M5 22V5a2 2 0 012-2h7a2 2 0 012 2v17"/><path d="M3 22h14"/><path d="M16 9h2a2 2 0 012 2v6a2 2 0 002 2"/></>,
    gauge: <><path d="M3 12a9 9 0 1118 0"/><path d="M12 12l4-3"/></>,
    cog: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>,
    pin: <><path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></>,
    arrow: <><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></>,
    heart: <><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></>,
    check: <><path d="M5 12l5 5L20 7"/></>,
    star: <><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></>,
    upload: <><path d="M12 16V4"/><path d="M5 11l7-7 7 7"/><path d="M3 20h18"/></>,
    chevron: <><polyline points="6 9 12 15 18 9"/></>,
    phone: <><path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></>,
    leaf: <><path d="M11 20A8 8 0 014 12c0-3.3 2.5-7 7.5-9 1 5 4 7 7.5 7v3a8 8 0 01-8 7z"/><path d="M11 20c0-5 2-8 6-9"/></>,
    map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    whatsapp: <><path d="M21 12.5a8.5 8.5 0 11-15.7-4.5L4 21l5-1.3A8.5 8.5 0 0021 12.5z"/><path d="M9 10c.4 1.5 1.5 2.7 3 3.5l1.5-1c.4-.2.8-.2 1.2 0l2 1c.4.2.5.7.3 1.1A3.5 3.5 0 0114 16c-3.3 0-7-3.7-7-7a3.5 3.5 0 011.4-3 .9.9 0 011.1.3l1 2c.2.4.2.8 0 1.2L9 10z"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name]}
    </svg>
  );
};

// ---- Image with placeholder fallback ----
const SmartImg = ({ src, alt, label, style, className }) => {
  const [err, setErr] = React.useState(false);
  if (err || !src) {
    return (
      <div className={`img-placeholder ${className || ""}`} style={style}>
        <span>{label || alt}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} style={style} onError={() => setErr(true)} />;
};

// ---- Header / Nav ----
const Header = ({ current, navigate }) => {
  const links = [
    { id: "home", label: "Inicio" },
    { id: "comprar", label: "Comprar" },
    { id: "vender", label: "Vender" },
    { id: "como-funciona", label: "Cómo funciona" },
    { id: "sobre", label: "Sobre nosotros" },
  ];
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <a className="brand" onClick={() => navigate("home")} href="#">
          <img src="assets/logo.png" alt="Campers Nova" />
        </a>
        <nav className="nav-links">
          {links.map((l) => (
            <a key={l.id} href="#" className={current === l.id ? "active" : ""} onClick={(e) => { e.preventDefault(); navigate(l.id); }}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-cta">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("comprar")}>Comprar</button>
          <button className="btn btn-accent btn-sm" onClick={() => navigate("vender")}>Vender mi vehículo</button>
        </div>
      </div>
    </header>
  );
};

// ---- Footer ----
const Footer = ({ navigate }) => (
  <footer>
    <div className="container">
      <div className="footer-grid">
        <div className="footer-brand">
          <a className="brand" href="#" onClick={(e) => { e.preventDefault(); navigate("home"); }}>
            <img src="assets/logo.png" alt="Campers Nova" style={{ height: 44 }} />
          </a>
          <p>Compraventa de campers y autocaravanas con acompañamiento profesional, transparente y cercano. Desde 2019.</p>
          <div className="footer-rating">
            <div className="stars">
              {[...Array(5)].map((_,k)=>(
                <svg key={k} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>
              ))}
            </div>
            <span><strong>4,6</strong> · 36 reseñas en Google</span>
          </div>
        </div>
        <div>
          <h5>Explora</h5>
          <ul>
            <li><a href="#" onClick={(e)=>{e.preventDefault();navigate("comprar");}}>Comprar</a></li>
            <li><a href="#" onClick={(e)=>{e.preventDefault();navigate("vender");}}>Vender</a></li>
            <li><a href="#" onClick={(e)=>{e.preventDefault();navigate("como-funciona");}}>Cómo funciona</a></li>
            <li><a href="#" onClick={(e)=>{e.preventDefault();navigate("sobre");}}>Sobre nosotros</a></li>
          </ul>
        </div>
        <div>
          <h5>Contacto</h5>
          <ul>
            <li><a href="tel:+34629925821">629 92 58 21</a></li>
            <li><a href="mailto:info@campersnova.com">info@campersnova.com</a></li>
            <li><a href="https://www.instagram.com/campersnova/" target="_blank" rel="noopener noreferrer">Instagram · @campersnova</a></li>
            <li><a href="https://wa.me/34629925821" target="_blank" rel="noopener noreferrer">WhatsApp directo</a></li>
            <li><a href="https://www.google.com/maps/dir//CAMPERS+NOVA,+SL,+Carrer+Torre+de+Cellers,+08150,+Barcelona/@41.4089216,2.1528576,10z/data=!4m8!4m7!1m0!1m5!1m1!1s0x12a4ebf0fa3704c3:0x5219e56327ff3bb7!2m2!1d2.2429082!2d41.5648851" target="_blank" rel="noopener noreferrer">Carrer Torre de Cellers<br/>08150 Barcelona</a></li>
          </ul>
        </div>
        <div>
          <h5>Horario</h5>
          <ul className="hours-list">
            <li><span>Lun – Vie</span><span>10:00 – 19:00</span></li>
            <li><span>Sábado</span><span>10:00 – 13:00</span></li>
            <li><span>Domingo</span><span>Cerrado</span></li>
          </ul>
        </div>
      </div>
      <div className="footer-foot">
        <span>© 2026 CAMPERS NOVA, S.L. · CIF B-12345678</span>
        <span>BARCELONA · 08150</span>
      </div>
    </div>
  </footer>
);

// ---- WhatsApp FAB ----
const WhatsAppFab = () => (
  <button className="wa-fab" aria-label="Contactar por WhatsApp" onClick={() => window.alert("Abriría WhatsApp en una web real")}>
    <Icon name="whatsapp" size={26} />
  </button>
);

// ---- Vehicle card ----
const VCard = ({ v, navigate, fav, onFav }) => (
  <article className="vcard" onClick={() => navigate("detalle", v.id)}>
    <div className="vcard-img">
      <SmartImg label={v.placeholder} alt={v.title} />
      <div className="vcard-tags">
        {v.tags.map((t) => {
          const cls = t === "Nueva entrada" ? "tag tag-warm" :
                      t === "Premium" || t === "Casi nueva" ? "tag tag-dark" : "tag tag-success";
          return <span key={t} className={cls}>{t}</span>;
        })}
      </div>
      <button className={`vcard-fav ${fav ? "active" : ""}`} aria-label="Guardar"
              onClick={(e) => { e.stopPropagation(); onFav?.(v.id); }}>
        <Icon name="heart" size={16} />
      </button>
    </div>
    <div className="vcard-body">
      <div className="vcard-head">
        <div>
          <h4 className="vcard-title">{v.title}</h4>
          <div className="vcard-sub">{v.year} · {v.location}</div>
        </div>
        <div className="vcard-price">
          {eur(v.price)}
          <span className="small">precio total</span>
        </div>
      </div>
      <div className="vcard-specs">
        <div className="vcard-spec"><span className="lab">Año</span><span className="val">{v.year}</span></div>
        <div className="vcard-spec"><span className="lab">KM</span><span className="val">{km(v.km).replace(" km","")}</span></div>
        <div className="vcard-spec"><span className="lab">Plazas</span><span className="val">{v.seats}/{v.sleeps}</span></div>
        <div className="vcard-spec"><span className="lab">Cambio</span><span className="val">{v.transmission === "Automático" ? "Auto" : "Manual"}</span></div>
      </div>
    </div>
  </article>
);

window.CN = { VEHICLES, eur, km, Icon, SmartImg, Header, Footer, WhatsAppFab, VCard };

/**
 * Núcleo compartilhado: tipos, carregamento do catálogo, formatação,
 * WhatsApp, imagens e comportamento comum (cabeçalho, rodapé, rolagem).
 *
 * Todos os dados comerciais vêm de data/catalog.json. Nenhum componente
 * guarda preço ou condição próprios.
 */

/**
 * @typedef {"pf"|"cnpj"|"rural"} BuyerCategoryId
 * @typedef {"pronta-entrega"|"sob-consulta"|"encomenda"} Availability
 *
 * @typedef {Object} VehicleImage
 * @property {string|null} src   Caminho da foto licenciada. null = foto pendente.
 * @property {string} shot       Enquadramento (ex.: "Frontal 3/4").
 * @property {string} alt        Texto alternativo.
 * @property {string} brief      Direção de arte para a produção da foto.
 * @property {string} [srcset]
 * @property {boolean} [illustrative] true = imagem ilustrativa (gerada ou não oficial).
 * @property {{src: string, poster: string}} [video] Loop curto exibido onde houver espaço para movimento.
 *
 * @typedef {Object} VehicleColor
 * @property {string} id
 * @property {string} name
 * @property {string} hex
 * @property {VehicleImage[]} images  Fotos desta cor, no mesmo enquadramento entre as cores.
 *
 * @typedef {Object} VehiclePrice
 * @property {"consulte"|"demonstrativo"|"verificado"} mode
 * @property {number|null} value
 * @property {string|null} source     Obrigatório em "verificado".
 * @property {string|null} checkedAt  AAAA-MM-DD da conferência.
 *
 * @typedef {Object} Spec
 * @property {string} label
 * @property {string|null} value null = aguardando ficha técnica oficial.
 *
 * @typedef {Object} Vehicle
 * @property {string} id
 * @property {string} model
 * @property {string} version
 * @property {"night"|null} edition
 * @property {number} yearManufacture
 * @property {number} yearModel
 * @property {string} engine
 * @property {string} fuel
 * @property {string} transmission
 * @property {string} traction
 * @property {Availability} availability
 * @property {string|null} deliveryNote
 * @property {boolean} verified  false = dados técnicos ainda não conferidos.
 * @property {string} summary
 * @property {string[]} highlights
 * @property {Spec[]} specs
 * @property {string[]} equipment
 * @property {VehicleImage[]} images  Fotos comuns a todas as cores (interior, detalhes).
 * @property {VehicleColor[]} colors
 * @property {VehiclePrice} price     Preço exibido quando não há oferta vigente.
 * // Campos derivados em normalize():
 * @property {Model} [modelRef]
 * @property {string} [fullName]
 * @property {Offer[]} [offers]  Somente ofertas vigentes, da mais barata para a mais cara.
 *
 * @typedef {Object} Financing
 * @property {number} entryPct
 * @property {number} months
 * @property {number} monthlyRate  Taxa mensal em %.
 *
 * @typedef {Object} Offer
 * @property {string} id
 * @property {string} vehicle
 * @property {string|null} campaign
 * @property {BuyerCategoryId[]} categories
 * @property {string[]} types
 * @property {string} modality
 * @property {number|null} referencePrice
 * @property {number} price
 * @property {string} priceLabel
 * @property {Financing|null} financing
 * @property {string|null} color
 * @property {string} validFrom   AAAA-MM-DD
 * @property {string} validUntil  AAAA-MM-DD
 * @property {number|null} stockLimit
 * @property {string[]} restrictions
 * @property {string} paymentConditions
 * @property {string} legal
 *
 * @typedef {Object} Model
 * @property {string} id
 * @property {string} name
 * @property {string} segment
 * @property {string} tagline
 *
 * @typedef {Object} Dealer
 * @property {string} id
 * @property {string} name
 * @property {string} city
 * @property {string} uf
 * @property {string} region
 * @property {string|null} address
 * @property {string|null} cep
 * @property {string|null} phone
 * @property {string|null} whatsapp  Somente dígitos, com DDI (ex.: 5511999999999).
 * @property {string|null} hours
 * @property {number} lat
 * @property {number} lng
 * @property {"exata"|"cidade"} coordsPrecision
 * @property {"all"|string[]} vehicles
 *
 * @typedef {Object} Lead
 * @property {string} name
 * @property {string} phone     WhatsApp com DDD
 * @property {string} city
 * @property {string} [vehicle]
 * @property {string} [offer]
 * @property {string} [color]
 * @property {string} [message]
 * @property {string} [dealer]
 * @property {string} createdAt
 */

const CATALOG_URL = "data/catalog.json";
let catalogPromise = null;

/** Data de hoje (fuso local) em AAAA-MM-DD, para comparar com a validade das ofertas. */
export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isOfferActive(offer, today = todayISO()) {
  return offer.validFrom <= today && today <= offer.validUntil;
}

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`Catálogo indisponível (${r.status})`);
        return r.json();
      })
      .then(normalize);
  }
  return catalogPromise;
}

function normalize(raw) {
  const today = todayISO();
  const models = new Map(raw.models.map((m) => [m.id, m]));
  const campaigns = new Map(raw.campaigns.map((c) => [c.id, c]));
  const categories = new Map(raw.buyerCategories.map((c) => [c.id, c]));
  const offerTypes = new Map(raw.offerTypes.map((t) => [t.id, t]));

  const activeOffers = raw.offers.filter((o) => isOfferActive(o, today));
  // Só entram no site versões com pelo menos uma foto (ou "published": true no cadastro).
  const hasPhoto = (v) => [...(v.images || []), ...(v.colors || []).flatMap((c) => c.images)].some((i) => i && i.src);
  const published = raw.vehicles.filter((v) => v.published === true || (v.published !== false && hasPhoto(v)));
  const vehicles = published.map((v) => {
    const modelRef = models.get(v.model);
    return {
      colors: [],
      price: { mode: "consulte", value: null, source: null, checkedAt: null },
      ...v,
      modelRef,
      fullName: `${modelRef ? modelRef.name : v.model} ${v.version}`,
      offers: activeOffers.filter((o) => o.vehicle === v.id).sort((a, b) => a.price - b.price),
    };
  });

  const usedModels = new Set(vehicles.map((v) => v.model));
  return {
    ...raw,
    models: raw.models.filter((m) => usedModels.has(m.id)),
    today,
    activeOffers,
    vehicles,
    vehicleById: new Map(vehicles.map((v) => [v.id, v])),
    modelById: models,
    campaignById: campaigns,
    categoryById: categories,
    offerTypeById: offerTypes,
    dealerById: new Map(raw.dealers.map((d) => [d.id, d])),
  };
}

/* ---------- Seleção de oferta ---------- */

/**
 * Escolhe a oferta exibida para um veículo. Com categoria definida, só
 * considera ofertas daquela categoria. Sem categoria, prefere a categoria
 * padrão (pessoa física) para não mostrar preço de venda direta a quem
 * não é elegível.
 */
export function pickOffer(vehicle, { category = "", types = [] } = {}, defaultCategory = "pf") {
  let list = vehicle.offers;
  if (types.length) list = list.filter((o) => o.types.some((t) => types.includes(t)));
  if (category) return list.find((o) => o.categories.includes(category)) || null;
  return list.find((o) => o.categories.includes(defaultCategory)) || list[0] || null;
}

/** Fotos de uma versão: as da cor escolhida primeiro, depois as comuns. */
export function vehicleImages(vehicle, colorId) {
  const color = vehicle.colors.find((c) => c.id === colorId) || vehicle.colors[0];
  return [...(color ? color.images : []), ...vehicle.images];
}

/** Preço numérico conhecido (oferta vigente ou preço demonstrativo/verificado), ou null. */
export function knownPrice(vehicle, offer) {
  if (offer) return offer.price;
  const p = vehicle.price;
  return p && p.mode !== "consulte" && p.value ? p.value : null;
}

export function savings(offer) {
  if (!offer || !offer.referencePrice || offer.referencePrice <= offer.price) return 0;
  return offer.referencePrice - offer.price;
}

/* ---------- Formatação ---------- */

const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR");

export const fmtBRL = (n) => brl0.format(n);
export const fmtBRL2 = (n) => brl2.format(n);
export const fmtNum = (n) => num.format(n);
export const fmtRate = (r) => `${String(r).replace(".", ",")}% a.m.`;

export function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function yearsLabel(v) {
  return `${v.yearManufacture}/${v.yearModel}`;
}

export const AVAILABILITY_LABEL = {
  "pronta-entrega": "Pronta entrega",
  "sob-consulta": "Disponibilidade sob consulta",
  encomenda: "Sob encomenda",
};

export function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function slugify(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function normalizeText(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function vehicleURL(v) {
  return `veiculo.html?v=${encodeURIComponent(v.id)}`;
}

/* ---------- Armazenamento local (conveniência por visitante) ---------- */

export const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* armazenamento bloqueado */ }
  },
};

const DEALER_KEY = "ram-platform:dealer";
export const getSelectedDealerId = () => store.get(DEALER_KEY);
export function setSelectedDealerId(id) {
  store.set(DEALER_KEY, id);
  document.dispatchEvent(new CustomEvent("dealer:change", { detail: { id } }));
}

/* ---------- WhatsApp ---------- */

/** Número usado no atendimento: unidade escolhida > número geral da operação. */
export function resolveWhatsApp(catalog) {
  const dealer = catalog.dealerById.get(getSelectedDealerId());
  return (dealer && dealer.whatsapp) || catalog.operation.whatsapp || null;
}

/**
 * Monta o link do WhatsApp. Sem número cadastrado, o link abre o WhatsApp
 * para o visitante escolher o contato (modo demonstração).
 */
export function whatsappURL(catalog, message, placement) {
  const number = resolveWhatsApp(catalog);
  // A origem vai no fim da mensagem: quem recebe sabe de qual ponto do site veio o contato.
  const text = encodeURIComponent(placement ? `${message}

(ref: ${placement})` : message);
  return number ? `https://wa.me/${number.replace(/\D/g, "")}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function vehicleMessage(catalog, vehicle, offer, colorName) {
  const lines = [`Olá! Tenho interesse na ${vehicle.fullName} ${yearsLabel(vehicle)}${colorName ? `, cor ${colorName}` : ""}.`];
  if (offer) {
    const camp = offer.campaign && catalog.campaignById.get(offer.campaign);
    lines.push(`Oferta: ${offer.id}${camp ? ` (${camp.name})` : ""} · ${offer.priceLabel} ${fmtBRL(offer.price)}.`);
  }
  lines.push(offer ? "Pode confirmar a disponibilidade e as condições?" : "Pode me informar preço, condições e disponibilidade?");
  return lines.join("\n");
}

export function generalMessage(catalog) {
  return (catalog && catalog.operation.whatsappMessage) || "Olá! Quero falar com um consultor sobre as picapes RAM disponíveis.";
}

/** Registra cliques no WhatsApp em window.dataLayer (pronto para GA4/GTM), com a origem do clique. */
function initWhatsAppTracking() {
  window.dataLayer = window.dataLayer || [];
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="wa.me/"]');
    if (!a) return;
    const text = new URL(a.href).searchParams.get("text") || "";
    const ref = (text.match(/\(ref: ([\w-]+)\)/) || [])[1] || "sem-origem";
    window.dataLayer.push({ event: "whatsapp_click", placement: ref, vehicle: a.dataset.waVehicle || null, page: location.pathname });
  });
}

/* ---------- Imagens ---------- */

/**
 * Foto do veículo ou, sem foto licenciada, um quadro de produção com a
 * direção de arte. O quadro nunca finge ser a versão anunciada.
 */
export function imageSlot(img, { eager = false, sizes = "100vw", className = "", video = false } = {}) {
  if (img && img.video && video && !reducedMotion) {
    const tag = `<video class="photo ${className}" src="${escapeHTML(img.video.src)}" poster="${escapeHTML(img.video.poster)}" autoplay muted loop playsinline preload="metadata" aria-label="${escapeHTML(img.alt)}"></video>`;
    return `<span class="photo-frame">${tag}</span>`;
  }
  if (img && img.src) {
    const tag = `<img class="photo ${className}" src="${escapeHTML(img.src)}"${img.srcset ? ` srcset="${escapeHTML(img.srcset)}" sizes="${sizes}"` : ""} alt="${escapeHTML(img.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    return img.illustrative ? `<span class="photo-frame">${tag}<span class="illus-tag">Imagem ilustrativa</span></span>` : tag;
  }
  const shot = img ? img.shot : "Foto";
  const brief = img ? img.brief : "";
  const alt = img ? img.alt : "Foto pendente";
  return `<div class="slot ${className}" role="img" aria-label="${escapeHTML(`Foto pendente: ${alt}`)}">
    <span class="slot-tag">Foto pendente</span>
    <span class="slot-shot">${escapeHTML(shot)}</span>
    ${brief ? `<span class="slot-brief">${escapeHTML(brief)}</span>` : ""}
  </div>`;
}

/* ---------- Comportamento comum ---------- */

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export let lenis = null;

export function initSmoothScroll() {
  if (reducedMotion || !window.Lenis || !window.gsap) return null;
  lenis = new window.Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  if (window.ScrollTrigger) lenis.on("scroll", window.ScrollTrigger.update);
  window.gsap.ticker.add((time) => lenis.raf(time * 1000));
  window.gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function headerOffset() {
  const h = document.querySelector(".site-header");
  return h ? h.offsetHeight : 0;
}

export function scrollToEl(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -headerOffset() - 8 });
  else el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

export function lockScroll(locked) {
  document.documentElement.classList.toggle("scroll-locked", locked);
  if (lenis) locked ? lenis.stop() : lenis.start();
}

/** Mantém o foco dentro de um painel aberto (menu, filtros). */
export function trapFocus(panel, onClose) {
  const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
  function onKey(e) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key !== "Tab") return;
    const items = [...panel.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  panel.addEventListener("keydown", onKey);
  return () => panel.removeEventListener("keydown", onKey);
}

function initAnchors() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    const samePage = url.pathname === location.pathname || (url.pathname.endsWith("/index.html") && location.pathname.endsWith("/"));
    if (!samePage || !url.hash || url.hash === "#") return;
    if (url.search && url.search !== location.search) {
      // Link com filtro (ex.: rodapé "?m=rampage#catalogo") aplicado sem recarregar.
      const q = new URLSearchParams(url.search);
      const target = document.getElementById(url.hash.slice(1));
      if (!target || !q.get("m")) return;
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("catalog:filter", { detail: { model: q.get("m").split(",") } }));
      return;
    }
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(target);
    history.replaceState(null, "", url.hash);
  });
}

let releaseMenuTrap = null;
function closeMenu() {
  const btn = document.querySelector(".menu-toggle");
  const nav = document.getElementById("site-nav");
  if (!btn || !nav || !nav.classList.contains("is-open")) return;
  nav.classList.remove("is-open");
  btn.setAttribute("aria-expanded", "false");
  lockScroll(false);
  if (releaseMenuTrap) releaseMenuTrap();
  btn.focus();
}

function initHeader(catalog) {
  const header = document.querySelector(".site-header");
  const btn = document.querySelector(".menu-toggle");
  const nav = document.getElementById("site-nav");

  const onScroll = () => header && header.classList.toggle("is-solid", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (btn && nav) {
    btn.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      if (!open) return closeMenu();
      nav.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      lockScroll(true);
      releaseMenuTrap = trapFocus(header, closeMenu);
      const first = nav.querySelector("a");
      if (first) first.focus();
    });
    window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => e.matches && closeMenu());
  }

  bindText(catalog);
  document.querySelectorAll("[data-footer-models]").forEach((ul) => {
    ul.innerHTML = catalog.models.map((m) => `<li><a href="index.html?m=${encodeURIComponent(m.id)}#catalogo">${escapeHTML(m.name)}</a></li>`).join("");
  });
  refreshContactLinks(catalog);
  document.addEventListener("dealer:change", () => refreshContactLinks(catalog));
}

/** Preenche [data-bind] com dados da operação; campos vazios mostram "a informar". */
function bindText(catalog) {
  const op = catalog.operation;
  const values = {
    "op-name": op.name,
    "op-short": op.shortName,
    "op-legal": op.legalName,
    "op-cnpj": op.cnpj,
    "op-address": op.address,
    "op-email": op.email,
    "op-phone": op.phone,
    "op-hours": op.hours,
    "op-controller": op.privacyController || op.legalName,
    "op-dpo": op.dpoEmail,
    "op-disclaimer": op.brandDisclaimer,
    "demo-notice": catalog.meta.demoNotice,
    "updated-at": fmtDate(catalog.meta.updatedAt),
    year: String(new Date().getFullYear()),
  };
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const v = values[el.dataset.bind];
    const row = el.closest("[data-bind-row]");
    if (v) { el.textContent = v; if (row) row.hidden = false; }
    else if (row) row.hidden = true; // dado não cadastrado: a linha some, sem "a informar" na tela
    else { el.textContent = "a informar"; el.classList.add("is-missing"); }
  });
  document.querySelectorAll(".demo-strip").forEach((el) => { el.hidden = !catalog.meta.demo; });
}

function refreshContactLinks(catalog) {
  document.querySelectorAll("[data-wa-general]").forEach((a) => {
    a.href = whatsappURL(catalog, generalMessage(catalog), a.dataset.waGeneral || "geral");
    a.target = "_blank";
    a.rel = "noopener";
  });
  const dealer = catalog.dealerById.get(getSelectedDealerId());
  document.querySelectorAll("[data-dealer-chip]").forEach((el) => {
    el.textContent = dealer ? dealer.city : "Escolher unidade";
  });
}

/** Animações de entrada das seções comuns (cada seção declara a sua em data-reveal). */
export function initReveals(root = document) {
  const items = root.querySelectorAll("[data-reveal]");
  if (reducedMotion || !window.gsap || !window.ScrollTrigger) return;
  const presets = {
    "fade-up": { y: 50, opacity: 0, duration: 0.9, ease: "power3.out" },
    "slide-left": { x: -80, opacity: 0, duration: 0.9, ease: "power3.out" },
    "slide-right": { x: 80, opacity: 0, duration: 0.9, ease: "power3.out" },
    "scale-up": { scale: 0.9, opacity: 0, duration: 1, ease: "power2.out" },
    "rotate-in": { y: 40, rotation: 2, opacity: 0, duration: 0.9, ease: "power3.out" },
    "clip-reveal": { clipPath: "inset(100% 0 0 0)", opacity: 0, duration: 1.1, ease: "power4.inOut" },
  };
  items.forEach((section) => {
    const preset = presets[section.dataset.reveal] || presets["fade-up"];
    const kids = section.querySelectorAll("[data-reveal-item]");
    const targets = kids.length ? kids : [section];
    window.gsap.from(targets, {
      ...preset,
      stagger: 0.1,
      scrollTrigger: { trigger: section, start: "top 80%", once: true },
    });
  });
}

/** Pausa vídeos fora da tela e retoma quando voltam. Observa também vídeos inseridos depois. */
function initVideoVisibility() {
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const v = en.target;
    if (en.isIntersecting) v.play().catch(() => {});
    else v.pause();
  }), { rootMargin: "120px" });
  const watch = (root) => root.querySelectorAll && root.querySelectorAll("video[autoplay]").forEach((v) => { if (!v.dataset.watched) { v.dataset.watched = "1"; io.observe(v); } });
  watch(document);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches("video[autoplay]") ? watch(n.parentElement) : watch(n))))).observe(document.body, { childList: true, subtree: true });
}

export async function boot() {
  document.documentElement.classList.add("js");
  if (reducedMotion) document.documentElement.classList.add("reduced");
  if (window.gsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
  initSmoothScroll();
  initAnchors();
  initWhatsAppTracking();
  initVideoVisibility();
  const catalog = await loadCatalog();
  initHeader(catalog);
  return catalog;
}

export function fatal(message) {
  const main = document.querySelector("main");
  if (!main) return;
  main.innerHTML = `<section class="state-panel wrap"><p class="eyebrow">Erro</p><h1 class="h-section">Não foi possível carregar o catálogo.</h1><p>${escapeHTML(message)}</p><p>Abra o site por um servidor HTTP (veja o README), não direto pelo arquivo.</p></section>`;
}

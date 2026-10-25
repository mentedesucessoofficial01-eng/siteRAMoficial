import {
  boot, escapeHTML, fatal, fmtBRL, imageSlot, initReveals, knownPrice, pickOffer, vehicleImages,
  vehicleMessage, vehicleURL, whatsappURL, yearsLabel, AVAILABILITY_LABEL,
} from "./core.js";
import { bindCardColors, categoryChips, colorSwatches, offerBadges, offerRules, priceBlock, swapImage, vehicleCard } from "./cards.js";
import { mountLeadForm } from "./lead-form.js";

const MAIN_SIZES = "(min-width: 1024px) 58vw, 100vw";

function setMeta(catalog, v, offer) {
  const price = knownPrice(v, offer);
  const title = `${v.fullName} ${yearsLabel(v)}${price ? ` por ${fmtBRL(price)}` : " · consulte condições"}`;
  const desc = `${v.summary} ${offer ? `${offer.priceLabel} ${fmtBRL(offer.price)}, válida até ${offer.validUntil.split("-").reverse().join("/")}.` : "Preço e condições informados pelo consultor."}`;
  document.title = title;
  const set = (sel, attr, val) => document.querySelector(sel)?.setAttribute(attr, val);
  set('meta[name="description"]', "content", desc);
  set('meta[property="og:title"]', "content", title);
  set('meta[property="og:description"]', "content", desc);
  const url = `${catalog.operation.siteUrl}/${vehicleURL(v)}`;
  set('link[rel="canonical"]', "href", url);
  set('meta[property="og:url"]', "content", url);
  const img = vehicleImages(v).find((i) => i.src);
  if (img) set('meta[property="og:image"]', "content", `${catalog.operation.siteUrl}/${img.src}`);

  // Dados estruturados apenas quando preço e ficha forem reais.
  if (!catalog.meta.demo && v.verified && offer) {
    const ld = {
      "@context": "https://schema.org",
      "@type": "Vehicle",
      name: v.fullName,
      modelDate: String(v.yearModel),
      vehicleEngine: { "@type": "EngineSpecification", name: v.engine },
      fuelType: v.fuel,
      ...(img ? { image: `${catalog.operation.siteUrl}/${img.src}` } : {}),
      offers: {
        "@type": "Offer", price: offer.price, priceCurrency: "BRL",
        priceValidUntil: offer.validUntil, availability: v.availability === "pronta-entrega" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      },
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }
}

function notFound(catalog, id) {
  document.title = "Versão não encontrada";
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex";
  document.head.appendChild(robots);
  document.getElementById("vehicle").innerHTML = `
    <section class="state-panel wrap">
      <p class="eyebrow">404 / Versão</p>
      <h1 class="h-section">Essa versão não está no catálogo.</h1>
      <p class="lede">${id ? `Não encontramos “${escapeHTML(id)}”. ` : ""}Ela pode ter saído de linha ou o endereço pode estar incompleto.</p>
      <div class="cta-row"><a class="btn btn--accent btn--lg" href="index.html#vitrine">Ver os modelos</a><a class="btn btn--ghost btn--lg" href="${whatsappURL(catalog, catalog.operation.whatsappMessage, "pagina-404")}" target="_blank" rel="noopener">Falar com consultor</a></div>
    </section>`;
}

function render(catalog, v) {
  const night = v.edition === "night";
  document.body.classList.toggle("is-night", night);
  let offer = pickOffer(v, {}, catalog.defaultCategory);
  let colorId = v.colors[0]?.id || null;
  setMeta(catalog, v, offer);

  const siblings = catalog.vehicles.filter((x) => x.id !== v.id);
  const otherNights = night ? catalog.vehicles.filter((x) => x.edition === "night" && x.id !== v.id) : [];
  const grille = vehicleImages(v).find((i) => /grade/i.test(i.shot));
  const colorName = () => v.colors.find((c) => c.id === colorId)?.name;

  const root = document.getElementById("vehicle");
  root.innerHTML = `
    ${night ? `
    <section class="vd-night-intro" aria-label="Night Edition">
      <span class="vd-night-word" aria-hidden="true">Night Edition</span>
      <div class="wrap vd-night-grid">
        <figure>${imageSlot(grille || vehicleImages(v)[0], { eager: true, video: true })}</figure>
        <div class="vd-night-copy">
          <p class="eyebrow">Versão especial · ${escapeHTML(v.modelRef.name)}</p>
          <p class="lede" style="color:var(--c-paper)">${escapeHTML(v.summary)}</p>
          <p>Grade, emblemas e rodas no mesmo preto.</p>
        </div>
      </div>
    </section>` : ""}

    <section class="vd-top wrap">
      <nav aria-label="Trilha"><ol class="crumbs">
        <li><a href="index.html">Início</a></li>
        <li><a href="index.html?m=${encodeURIComponent(v.model)}#catalogo">${escapeHTML(v.modelRef.name)}</a></li>
        <li aria-current="page">${escapeHTML(v.version)}</li>
      </ol></nav>

      <div class="vd-layout">
        <div class="vd-gallery">
          <div class="vd-main" data-main></div>
          <div class="vd-thumbs" role="group" aria-label="Galeria" data-thumbs></div>
        </div>

        <aside class="vd-panel" aria-label="Preço e contato">
          <div>
            <p class="vd-model">${escapeHTML(v.modelRef.name)} · ${escapeHTML(v.modelRef.segment)}</p>
            <h1 class="vd-title">${escapeHTML(v.fullName)}</h1>
          </div>
          <p class="vd-meta">${escapeHTML(v.summary)}</p>
          <div data-colors>${colorSwatches(v, colorId)}</div>
          ${v.offers.length > 1 ? `<div class="tabs vd-offer-tabs" role="radiogroup" aria-label="Condição por perfil">
            ${v.offers.map((o) => `<button type="button" class="tab" role="radio" data-offer-tab="${o.id}">${o.categories.map((c) => escapeHTML(catalog.categoryById.get(c)?.label || c)).join(" / ")}</button>`).join("")}
          </div>` : ""}
          <div data-offer-view></div>
          <div class="vd-ctas">
            <a class="btn btn--accent btn--lg" data-wa-vehicle-link data-wa-vehicle="${v.id}" target="_blank" rel="noopener">Consultar condições no WhatsApp</a>
            <button type="button" class="btn btn--ghost btn--lg" data-go-lead>Pedir proposta por escrito</button>
          </div>
        </aside>
      </div>
    </section>

    <section class="vd-sec wrap" data-reveal="slide-left">
      <div class="sec-head"><p class="eyebrow" data-reveal-item>Destaques</p><h2 class="h-section" data-reveal-item>O que define esta versão.</h2></div>
      <ul class="vd-highlights">${v.highlights.map((h, i) => `<li data-reveal-item><span>0${i + 1}</span>${escapeHTML(h)}</li>`).join("")}</ul>
    </section>

    <section class="vd-sec wrap" id="proposta" data-reveal="fade-up">
      <div class="lead-layout">
        <div class="lead-intro">
          <p class="eyebrow" data-reveal-item>Proposta</p>
          <h2 class="h-section" data-reveal-item>Receba a proposta da ${escapeHTML(v.version)}.</h2>
          <p class="lede" data-reveal-item>A versão e a cor já vão preenchidas. O WhatsApp abre com a mensagem pronta.</p>
        </div>
        <div id="lead-vehicle"></div>
      </div>
    </section>

    ${siblings.length || otherNights.length ? `
    <section class="vd-sec wrap" data-reveal="rotate-in">
      <div class="sec-head"><p class="eyebrow" data-reveal-item>Veja também</p><h2 class="h-section" data-reveal-item>Outras versões.</h2></div>
      <div class="related" data-related>${[...new Set([...otherNights, ...siblings])].map((x) => {
        const o = pickOffer(x, {}, catalog.defaultCategory);
        return vehicleCard(catalog, x, o, x.offers.filter((y) => y !== o).length, "relacionados");
      }).join("")}</div>
    </section>` : ""}
  `;

  /* Galeria: fotos da cor escolhida + fotos comuns */
  const main = root.querySelector("[data-main]");
  const thumbs = root.querySelector("[data-thumbs]");
  let images = [];
  function renderGallery(first) {
    images = vehicleImages(v, colorId);
    if (first) main.innerHTML = imageSlot(images[0], { eager: !night, sizes: MAIN_SIZES, video: true });
    else swapImage(main, images[0], MAIN_SIZES, { video: true });
    thumbs.hidden = images.length < 2;
    thumbs.innerHTML = images.map((img, i) => `<button type="button" class="vd-thumb" data-thumb="${i}" aria-current="${i === 0}" aria-label="Ver ${escapeHTML(img.shot)}">${imageSlot(img, { sizes: "140px" })}${img.video ? '<span class="vd-thumb-play" aria-hidden="true">▶</span>' : ""}</button>`).join("");
  }
  thumbs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-thumb]");
    if (!b) return;
    swapImage(main, images[Number(b.dataset.thumb)], MAIN_SIZES, { video: true });
    thumbs.querySelectorAll("[data-thumb]").forEach((t) => t.setAttribute("aria-current", String(t === b)));
  });
  renderGallery(true);

  /* Cor */
  const colorsBox = root.querySelector("[data-colors]");
  colorsBox.addEventListener("click", (e) => {
    const b = e.target.closest("[data-color]");
    if (!b || b.dataset.color === colorId) return;
    colorId = b.dataset.color;
    colorsBox.innerHTML = colorSwatches(v, colorId);
    colorsBox.querySelector(`[data-color="${colorId}"]`)?.focus();
    renderGallery(false);
    refreshContacts();
  });

  /* Oferta exibida e contatos */
  const view = root.querySelector("[data-offer-view]");
  const wa = root.querySelector("[data-wa-vehicle-link]");
  const bar = document.querySelector("[data-vd-bar]");
  function refreshContacts() {
    wa.href = whatsappURL(catalog, vehicleMessage(catalog, v, offer, colorName()), "detalhe-versao");
    if (bar) {
      const barWa = bar.querySelector("[data-bar-wa]");
      barWa.href = whatsappURL(catalog, vehicleMessage(catalog, v, offer, colorName()), "barra-celular");
      barWa.dataset.waVehicle = v.id;
    }
  }
  function showOffer(o) {
    offer = o;
    view.innerHTML = `${priceBlock(catalog, o, { size: "lg", vehicle: v })}
      ${o ? `<div class="card-elig" style="margin-top:12px"><span class="card-elig-label">Condição para</span>${categoryChips(catalog, o.categories)}</div>` : ""}
      <div class="badges" style="margin-top:12px">${offerBadges(catalog, v, o)}</div>`;
    root.querySelectorAll("[data-offer-tab]").forEach((t) => t.setAttribute("aria-checked", String(o && t.dataset.offerTab === o.id)));
    if (bar) {
      const price = knownPrice(v, o);
      bar.querySelector("[data-bar-price]").textContent = price ? fmtBRL(price) : "Consulte condições";
      bar.querySelector("[data-bar-label]").textContent = o ? o.priceLabel : v.fullName;
    }
    refreshContacts();
  }
  root.querySelectorAll("[data-offer-tab]").forEach((t) => t.addEventListener("click", () => {
    showOffer(v.offers.find((o) => o.id === t.dataset.offerTab));
  }));

  const sendLead = () => document.dispatchEvent(new CustomEvent("lead:prefill", { detail: { vehicleId: v.id, offerId: offer ? offer.id : "", colorName: colorName() } }));
  root.querySelector("[data-go-lead]").addEventListener("click", sendLead);
  bar?.querySelector("[data-bar-lead]").addEventListener("click", sendLead);

  mountLeadForm(document.getElementById("lead-vehicle"), catalog, { vehicleId: v.id, offerId: offer?.id, colorName: colorName(), idPrefix: "lv", placement: "formulario-versao" });
  showOffer(offer);

  const related = root.querySelector("[data-related]");
  if (related) bindCardColors(related, catalog, (x) => pickOffer(x, {}, catalog.defaultCategory));

  /* Barra fixa no celular aparece depois que o painel de preço sai da tela */
  if (bar) {
    bar.hidden = false;
    const panel = root.querySelector(".vd-ctas");
    const update = () => bar.classList.toggle("is-visible", panel.getBoundingClientRect().bottom < 0);
    window.addEventListener("scroll", update, { passive: true });
    update();
  }
}

boot()
  .then((catalog) => {
    const id = new URLSearchParams(location.search).get("v");
    const v = id && catalog.vehicleById.get(id);
    if (!v) return notFound(catalog, id);
    render(catalog, v);
    initReveals();
  })
  .catch((err) => {
    console.error(err);
    fatal(err.message);
  });

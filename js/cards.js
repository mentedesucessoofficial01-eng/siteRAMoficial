import {
  escapeHTML, fmtBRL, fmtDate, fmtRate, imageSlot, savings, vehicleImages, vehicleURL,
  whatsappURL, vehicleMessage, yearsLabel, AVAILABILITY_LABEL,
} from "./core.js";

export function demoTag(catalog) {
  return catalog.meta.demo ? '<span class="demo-tag" title="Dado demonstrativo">Demo</span>' : "";
}

export function categoryChips(catalog, ids) {
  return ids
    .map((id) => catalog.categoryById.get(id))
    .filter(Boolean)
    .map((c) => `<span class="chip">${escapeHTML(c.label)}</span>`)
    .join("");
}

/** Selos só aparecem quando derivados de dado real do cadastro. */
export function offerBadges(catalog, vehicle, offer) {
  const out = [];
  if (vehicle.availability === "pronta-entrega") out.push("Pronta entrega");
  if (offer && offer.types.includes("taxa-promocional")) out.push("Taxa promocional");
  if (offer && offer.types.includes("venda-direta")) out.push("Venda direta");
  return out.map((b) => `<span class="badge">${escapeHTML(b)}</span>`).join("");
}

export function financingLine(offer) {
  if (!offer || !offer.financing) return "";
  const f = offer.financing;
  return `Entrada de ${f.entryPct}% + ${f.months}x · taxa ${fmtRate(f.monthlyRate)}`;
}

/**
 * Bloco de preço compartilhado entre card, vitrine, destaque e página de detalhe.
 * Com oferta vigente mostra a oferta; sem oferta, o preço cadastrado na versão
 * conforme o modo (consulte, demonstrativo ou verificado).
 */
export function priceBlock(catalog, offer, { size = "md", vehicle = null } = {}) {
  if (!offer) {
    const p = vehicle && vehicle.price;
    if (p && p.mode !== "consulte" && p.value) {
      const label = p.mode === "verificado" ? "Preço público sugerido" : "Preço demonstrativo — sujeito a atualização";
      const note = p.mode === "verificado" && p.source ? `Fonte: ${p.source}${p.checkedAt ? `, conferido em ${fmtDate(p.checkedAt)}` : ""}.` : "Confirme o valor e as condições com o consultor.";
      return `<div class="price price--${size}">
        <span class="price-label">${label}</span>
        <span class="price-value">${fmtBRL(p.value)}</span>
        <span class="price-note">${escapeHTML(note)}</span>
      </div>`;
    }
    return `<div class="price price--${size} price--empty">
      <span class="price-label">Preço</span>
      <span class="price-value">Consulte condições</span>
      <span class="price-note">Preço e condições comerciais informados pelo consultor na proposta.</span>
    </div>`;
  }
  const save = savings(offer);
  return `<div class="price price--${size}">
    <span class="price-label">${escapeHTML(offer.priceLabel)} ${demoTag(catalog)}</span>
    ${offer.referencePrice && save ? `<span class="price-ref"><s>${fmtBRL(offer.referencePrice)}</s> <span class="sr-only">preço de referência</span></span>` : ""}
    <span class="price-value">${fmtBRL(offer.price)}</span>
    ${save ? `<span class="price-save">${fmtBRL(save)} abaixo do preço de referência</span>` : ""}
    ${offer.financing ? `<span class="price-note">${escapeHTML(financingLine(offer))}</span>` : ""}
    <span class="price-valid">Válida até ${fmtDate(offer.validUntil)} · ${escapeHTML(offer.id)}</span>
  </div>`;
}

/** Bolinhas de cor. Só aparecem quando a versão tem fotos por cor. */
export function colorSwatches(vehicle, selectedId, { label = true } = {}) {
  if (!vehicle.colors.length) return "";
  const sel = selectedId || vehicle.colors[0].id;
  const current = vehicle.colors.find((c) => c.id === sel) || vehicle.colors[0];
  return `<div class="swatches" role="radiogroup" aria-label="Cor da ${escapeHTML(vehicle.fullName)}">
    ${vehicle.colors.map((c) => `<button type="button" class="swatch" role="radio" aria-checked="${c.id === current.id}" data-color="${c.id}" style="--sw:${escapeHTML(c.hex)}" title="${escapeHTML(c.name)}"><span class="sr-only">${escapeHTML(c.name)}</span></button>`).join("")}
    ${label ? `<span class="swatch-name" aria-live="polite">${escapeHTML(current.name)}</span>` : ""}
  </div>`;
}

export function vehicleCard(catalog, vehicle, offer, moreOffers = 0, placement = "catalogo") {
  const night = vehicle.edition === "night";
  const color = vehicle.colors[0];
  const img = vehicleImages(vehicle)[0];
  const sizes = "(min-width: 1100px) 30vw, (min-width: 700px) 45vw, 100vw";
  return `<article class="card${night ? " card--night" : ""}" data-vehicle="${escapeHTML(vehicle.id)}"${color ? ` data-current-color="${color.id}"` : ""}>
    <a class="card-media" href="${vehicleURL(vehicle)}" tabindex="-1" aria-hidden="true" data-media data-sizes="${sizes}">
      ${imageSlot(img, { sizes })}
      ${night ? '<span class="night-mark">Night Edition</span>' : ""}
    </a>
    <div class="card-body">
      <header class="card-head">
        <p class="card-model">${escapeHTML(vehicle.modelRef.name)}</p>
        <h3 class="card-title"><a href="${vehicleURL(vehicle)}">${escapeHTML(vehicle.version)}</a></h3>
        <p class="card-spec">${yearsLabel(vehicle)} · ${escapeHTML(vehicle.fuel)} · ${escapeHTML(vehicle.traction)} · ${escapeHTML(AVAILABILITY_LABEL[vehicle.availability])}</p>
      </header>
      ${colorSwatches(vehicle)}
      ${offer ? `<div class="card-elig"><span class="card-elig-label">Condição para</span>${categoryChips(catalog, offer.categories)}</div>` : ""}
      ${priceBlock(catalog, offer, { vehicle })}
      <p class="card-terms"><span>Condições comerciais</span>${offer ? escapeHTML(offer.paymentConditions) : "Informadas pelo consultor na proposta."}</p>
      <div class="badges">${offerBadges(catalog, vehicle, offer)}</div>
      ${moreOffers > 0 ? `<p class="card-more">+${moreOffers} ${moreOffers > 1 ? "condições" : "condição"} para outros perfis</p>` : ""}
      <div class="card-actions">
        <a class="btn btn--ghost" href="${vehicleURL(vehicle)}">Ver detalhes</a>
        <a class="btn btn--wa" data-wa-card data-wa-placement="${placement}" data-wa-vehicle="${escapeHTML(vehicle.id)}" href="${whatsappURL(catalog, vehicleMessage(catalog, vehicle, offer, color && color.name), placement)}" target="_blank" rel="noopener">Consultar condições <span class="sr-only">da ${escapeHTML(vehicle.fullName)}</span></a>
      </div>
    </div>
  </article>`;
}

/**
 * Troca de cor nos cards de um container (delegação de eventos).
 * A foto troca com esmaecimento; o WhatsApp passa a citar a cor escolhida.
 */
export function bindCardColors(root, catalog, getOffer) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".card [data-color]");
    if (!b) return;
    const card = b.closest(".card");
    const v = catalog.vehicleById.get(card.dataset.vehicle);
    const color = v && v.colors.find((c) => c.id === b.dataset.color);
    if (!color) return;
    card.dataset.currentColor = color.id;
    card.querySelectorAll("[data-color]").forEach((s) => s.setAttribute("aria-checked", String(s === b)));
    const name = card.querySelector(".swatch-name");
    if (name) name.textContent = color.name;
    const media = card.querySelector("[data-media]");
    swapImage(media, color.images[0], media.dataset.sizes);
    const wa = card.querySelector("[data-wa-card]");
    if (wa) wa.href = whatsappURL(catalog, vehicleMessage(catalog, v, getOffer ? getOffer(v) : null, color.name), wa.dataset.waPlacement);
  });
}

/** Troca a imagem de um container com esmaecimento cruzado (a nova entra por cima). */
export function swapImage(container, img, sizes = "100vw", { video = false } = {}) {
  if (!container) return;
  const old = container.querySelector(":scope > .photo-frame, :scope > .photo, :scope > .slot");
  const tmp = document.createElement("div");
  tmp.innerHTML = imageSlot(img, { eager: true, sizes, video });
  const next = tmp.firstElementChild;
  next.classList.add("is-entering");
  container.insertBefore(next, old ? old.nextSibling : container.firstChild);
  const done = () => { if (old) old.remove(); next.classList.remove("is-entering"); };
  const media = next.matches("img, video") ? next : next.querySelector("img, video");
  const start = () => requestAnimationFrame(() => {
    next.classList.add("is-in");
    setTimeout(done, 420);
  });
  if (media && media.tagName === "VIDEO") {
    if (media.readyState >= 2) start();
    else { media.addEventListener("loadeddata", start, { once: true }); media.addEventListener("error", done, { once: true }); }
  } else if (media && !media.complete) { media.addEventListener("load", start, { once: true }); media.addEventListener("error", done, { once: true }); }
  else start();
}

/** Regras completas de uma oferta, recolhíveis. */
export function offerRules(catalog, offer, { open = false } = {}) {
  const v = catalog.vehicleById.get(offer.vehicle);
  const camp = offer.campaign && catalog.campaignById.get(offer.campaign);
  const types = offer.types.map((t) => catalog.offerTypeById.get(t)?.label || t).join(", ");
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value ? escapeHTML(value) : '<span class="is-missing">não se aplica</span>'}</dd></div>`;
  return `<details class="rules"${open ? " open" : ""}>
    <summary>
      <span class="rules-code">${escapeHTML(offer.id)}</span>
      <span class="rules-name">${escapeHTML(v ? v.fullName : offer.vehicle)} ${v ? yearsLabel(v) : ""}</span>
      <span class="rules-cat">${offer.categories.map((c) => catalog.categoryById.get(c)?.short || c).join(" · ")}</span>
      <span class="rules-price">${fmtBRL(offer.price)}</span>
      <span class="rules-valid">até ${fmtDate(offer.validUntil)}</span>
    </summary>
    <dl class="rules-grid">
      ${row("Veículo e versão", v ? `${v.fullName} ${yearsLabel(v)}` : offer.vehicle)}
      ${row("Campanha", camp ? camp.name : null)}
      ${row("Modalidade", offer.modality)}
      ${row("Tipo de condição", types)}
      ${row("Perfil elegível", offer.categories.map((c) => catalog.categoryById.get(c)?.label || c).join(", "))}
      ${row("Preço de referência", offer.referencePrice ? fmtBRL(offer.referencePrice) : null)}
      ${row(offer.priceLabel, fmtBRL(offer.price))}
      ${row("Pagamento", offer.paymentConditions + (offer.financing ? ` (${financingLine(offer)})` : ""))}
      ${row("Cor e configuração", offer.color)}
      ${row("Validade", `${fmtDate(offer.validFrom)} a ${fmtDate(offer.validUntil)}`)}
      ${row("Limite da campanha", offer.stockLimit ? `${offer.stockLimit} unidades` : null)}
      ${row("Restrições", offer.restrictions.length ? offer.restrictions.join(" ") : null)}
    </dl>
    <p class="rules-legal">${escapeHTML(offer.legal)}</p>
  </details>`;
}

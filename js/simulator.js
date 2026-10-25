import { escapeHTML, fmtBRL, fmtBRL2, fmtRate, knownPrice, pickOffer, yearsLabel } from "./core.js";
import { demoTag } from "./cards.js";

/**
 * Parcela pela Tabela Price.
 * @param {number} principal valor financiado
 * @param {number} ratePct taxa mensal em %
 * @param {number} n número de parcelas
 */
export function pmt(principal, ratePct, n) {
  if (principal <= 0 || n <= 0) return 0;
  const r = ratePct / 100;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function simulate({ price, entry, months, ratePct }) {
  const financed = Math.max(0, price - entry);
  const installment = pmt(financed, ratePct, months);
  const total = entry + installment * months;
  return { financed, installment, total, interest: total - price };
}

const MONTHS = [12, 18, 24, 36, 48, 60];

const parseMoney = (s) => Number(String(s).replace(/\D/g, "")) || 0;
const parseRate = (s) => {
  const v = String(s).trim().replace(",", ".");
  return v === "" ? null : Number(v);
};

/**
 * @param {HTMLElement} root
 * @param {object} catalog
 * @param {{ vehicleId?: string, offerId?: string, onSend?: (summary: object) => void }} opts
 */
export function mountSimulator(root, catalog, opts = {}) {
  // Todas as versões entram: sem preço publicado, o visitante informa o valor.
  const priced = catalog.vehicles;
  const fixed = Boolean(opts.vehicleId);
  let vehicle = catalog.vehicleById.get(opts.vehicleId) || priced.find((v) => v.id === catalog.featuredVehicle) || priced[0];
  let offer = (opts.offerId && vehicle?.offers.find((o) => o.id === opts.offerId)) || (vehicle && pickOffer(vehicle, {}, catalog.defaultCategory));

  if (!vehicle) {
    root.innerHTML = '<p class="empty">Nenhuma versão com preço vigente para simular.</p>';
    return;
  }

  root.innerHTML = `
  <form class="sim" novalidate>
    <div class="sim-inputs">
      ${fixed ? "" : `<label class="field"><span class="field-label">Versão</span>
        <select name="vehicle">${priced.map((v) => `<option value="${v.id}">${escapeHTML(v.fullName)} ${yearsLabel(v)}</option>`).join("")}</select></label>`}
      <label class="field" data-offer-field><span class="field-label">Condição</span><select name="offer"></select></label>
      <label class="field"><span class="field-label">Valor do veículo</span>
        <input name="price" inputmode="numeric" autocomplete="off" placeholder="Informe o valor">
        <span class="field-hint" data-price-hint></span></label>
      <div class="field">
        <label class="field-label" for="${root.id}-entry">Entrada <output data-entry-pct></output></label>
        <input id="${root.id}-entry" name="entry" inputmode="numeric" autocomplete="off">
        <input name="entryRange" type="range" min="0" max="90" step="5" aria-label="Percentual de entrada">
      </div>
      <label class="field"><span class="field-label">Parcelas</span>
        <select name="months">${MONTHS.map((m) => `<option value="${m}">${m}x</option>`).join("")}</select></label>
      <label class="field"><span class="field-label">Taxa de juros mensal (%)</span>
        <input name="rate" inputmode="decimal" autocomplete="off" placeholder="Ex.: 1,49">
        <span class="field-hint" data-rate-hint></span></label>
      <button type="button" class="btn btn--line" data-apply hidden>Usar a condição da oferta</button>
    </div>
    <div class="sim-out" aria-live="polite">
      <p class="eyebrow">Estimativa ${demoTag(catalog)}</p>
      <p class="sim-installment"><span data-out-n></span><strong data-out-installment>—</strong></p>
      <dl class="sim-table">
        <div><dt>Valor financiado</dt><dd data-out-financed>—</dd></div>
        <div><dt>Total estimado</dt><dd data-out-total>—</dd></div>
        <div><dt>Juros estimados</dt><dd data-out-interest>—</dd></div>
      </dl>
      <p class="sim-disclaimer">Cálculo matemático (Tabela Price) sem IOF, tarifas, seguros ou análise de crédito. Não é proposta nem aprovação de financiamento. A condição final depende da instituição financeira.</p>
      <button type="button" class="btn btn--accent" data-send>Enviar esta simulação para análise</button>
    </div>
  </form>`;

  const f = root.querySelector("form");
  const q = (sel) => f.querySelector(sel);
  const out = {
    n: q("[data-out-n]"), installment: q("[data-out-installment]"), financed: q("[data-out-financed]"),
    total: q("[data-out-total]"), interest: q("[data-out-interest]"), pct: q("[data-entry-pct]"),
    hint: q("[data-rate-hint]"), apply: q("[data-apply]"), priceHint: q("[data-price-hint]"),
    offerField: q("[data-offer-field]"),
  };

  function fillOffers() {
    out.offerField.hidden = !vehicle.offers.length;
    f.offer.innerHTML = vehicle.offers.map((o) => {
      const cats = o.categories.map((c) => catalog.categoryById.get(c)?.short).join("/");
      return `<option value="${o.id}">${escapeHTML(o.id)} · ${cats} · ${fmtBRL(o.price)}</option>`;
    }).join("") || '<option value="">Sem oferta vigente</option>';
    if (offer) f.offer.value = offer.id;
  }

  function applyOffer() {
    const base = knownPrice(vehicle, offer);
    f.price.value = base ? fmtBRL(base) : "";
    out.priceHint.textContent = base ? "" : "Esta versão não tem preço publicado. Digite o valor informado pelo consultor.";
    const fin = offer && offer.financing;
    const entryPct = fin ? fin.entryPct : 30;
    f.entryRange.value = entryPct;
    f.entry.value = base ? fmtBRL(Math.round(base * entryPct / 100)) : "";
    f.months.value = String(fin && MONTHS.includes(fin.months) ? fin.months : 36);
    f.rate.value = fin ? String(fin.monthlyRate).replace(".", ",") : "";
    out.hint.textContent = fin
      ? `Taxa da oferta ${offer.id}: ${fmtRate(fin.monthlyRate)} (demonstrativa).`
      : "Sem taxa publicada. Informe a taxa da instituição financeira para estimar.";
    out.apply.hidden = true;
    calc();
  }

  function calc() {
    const price = parseMoney(f.price.value);
    let entry = Math.min(parseMoney(f.entry.value), price);
    const months = Number(f.months.value);
    const rate = parseRate(f.rate.value);
    out.pct.textContent = price ? `(${Math.round((entry / price) * 100)}%)` : "";
    const fin = offer && offer.financing;
    out.apply.hidden = !fin || (Number(f.entryRange.value) === fin.entryPct && months === fin.months && rate === fin.monthlyRate);

    if (!price || rate == null || Number.isNaN(rate) || rate < 0 || rate > 10) {
      out.n.textContent = "";
      out.installment.textContent = !price ? "Informe o valor" : rate == null ? "Informe a taxa" : "Taxa inválida";
      out.financed.textContent = price ? fmtBRL2(Math.max(0, price - entry)) : "—";
      out.total.textContent = "—";
      out.interest.textContent = "—";
      return null;
    }
    const r = simulate({ price, entry, months, ratePct: rate });
    out.n.textContent = `${months}x de `;
    out.installment.textContent = fmtBRL2(r.installment);
    out.financed.textContent = fmtBRL2(r.financed);
    out.total.textContent = fmtBRL2(r.total);
    out.interest.textContent = fmtBRL2(r.interest);
    return { price, entry, months, rate, ...r };
  }

  const reformat = (input) => {
    const v = parseMoney(input.value);
    input.value = v ? fmtBRL(v) : "";
  };

  f.addEventListener("input", (e) => {
    const t = e.target;
    if (t.name === "entryRange") {
      f.entry.value = fmtBRL(Math.round(parseMoney(f.price.value) * Number(t.value) / 100));
    } else if (t.name === "price") {
      // Mudou o valor: mantém o percentual de entrada escolhido.
      reformat(t);
      f.entry.value = fmtBRL(Math.round(parseMoney(f.price.value) * Number(f.entryRange.value) / 100));
    } else if (t.name === "entry") {
      reformat(t);
      const price = parseMoney(f.price.value);
      if (price) f.entryRange.value = Math.min(90, Math.round((parseMoney(f.entry.value) / price) * 20) * 5);
    }
    calc();
  });
  f.addEventListener("change", (e) => {
    if (e.target.name === "vehicle") {
      vehicle = catalog.vehicleById.get(e.target.value);
      offer = pickOffer(vehicle, {}, catalog.defaultCategory);
      fillOffers();
      applyOffer();
    } else if (e.target.name === "offer") {
      offer = vehicle.offers.find((o) => o.id === e.target.value) || null;
      applyOffer();
    } else calc();
  });
  out.apply.addEventListener("click", applyOffer);
  f.addEventListener("submit", (e) => e.preventDefault());

  q("[data-send]").addEventListener("click", () => {
    const r = calc();
    if (!r) { (parseMoney(f.price.value) ? f.rate : f.price).focus(); return; }
    const summary = {
      vehicleId: vehicle.id,
      offerId: offer ? offer.id : "",
      text: `Simulação estimada: ${vehicle.fullName}, valor ${fmtBRL(r.price)}, entrada ${fmtBRL(r.entry)}, ${r.months}x de ${fmtBRL2(r.installment)} a ${fmtRate(r.rate)}.`,
    };
    if (opts.onSend) opts.onSend(summary);
    else document.dispatchEvent(new CustomEvent("lead:prefill", { detail: summary }));
  });

  if (!fixed) f.vehicle.value = vehicle.id;
  fillOffers();
  applyOffer();

  /** Permite que a página de detalhe troque a oferta exibida. */
  root.setOffer = (id) => {
    const o = vehicle.offers.find((x) => x.id === id);
    if (!o) return;
    offer = o;
    f.offer.value = id;
    applyOffer();
  };
}

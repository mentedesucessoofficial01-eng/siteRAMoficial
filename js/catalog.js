import { escapeHTML, fmtBRL, knownPrice, lockScroll, pickOffer, trapFocus, scrollToEl } from "./core.js";
import { bindCardColors, vehicleCard } from "./cards.js";

const PAGE_SIZE = 6;

/** Grupos de filtro de múltipla escolha: chave no estado, rótulo e como ler o valor do veículo. */
const GROUPS = [
  { key: "model", param: "m", label: "Modelo", value: (v) => v.model, text: (id, c) => c.modelById.get(id)?.name || id },
  { key: "version", param: "v", label: "Versão", value: (v) => v.version },
  { key: "engine", param: "e", label: "Motorização", value: (v) => v.engine },
  { key: "fuel", param: "f", label: "Combustível", value: (v) => v.fuel },
  { key: "year", param: "y", label: "Ano-modelo", value: (v) => String(v.yearModel) },
];

const SORTS = {
  destaque: { label: "Destaques", fn: null },
  "preco-asc": { label: "Menor preço", fn: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) },
  "preco-desc": { label: "Maior preço", fn: (a, b) => (b.price ?? -1) - (a.price ?? -1) },
};

function emptyState() {
  return { model: [], version: [], engine: [], fuel: [], year: [], type: [], category: "", ready: false, pmin: null, pmax: null, sort: "destaque" };
}

export function mountCatalog(root, catalog) {
  const state = readURL(emptyState());
  let visible = PAGE_SIZE;

  const usedCategories = new Set(catalog.activeOffers.flatMap((o) => o.categories));
  const usedTypes = new Set(catalog.activeOffers.flatMap((o) => o.types));
  const categories = catalog.buyerCategories.filter((c) => usedCategories.has(c.id));
  const types = catalog.offerTypes.filter((t) => usedTypes.has(t.id));
  const groups = GROUPS.filter((g) => new Set(catalog.vehicles.map(g.value)).size > 1);
  const hasReady = catalog.vehicles.some((v) => v.availability === "pronta-entrega");
  const prices = catalog.vehicles.flatMap((v) => [...v.offers.map((o) => o.price), knownPrice(v, null)]).filter(Boolean);
  const hasPrices = prices.length > 0;
  const priceSteps = buildPriceSteps(prices);

  const featured = catalog.featuredVehicle;
  const els = {
    tabs: root.querySelector("[data-cat-tabs]"),
    panel: root.querySelector("[data-filter-panel]"),
    form: root.querySelector("[data-filter-form]"),
    grid: root.querySelector("[data-results]"),
    count: root.querySelectorAll("[data-count]"),
    chips: root.querySelector("[data-active-chips]"),
    more: root.querySelector("[data-more]"),
    sort: root.querySelector("[data-sort]"),
    open: root.querySelector("[data-filter-open]"),
    close: root.querySelectorAll("[data-filter-close]"),
    badge: root.querySelector("[data-filter-badge]"),
  };

  /* ---- Abas de perfil de comprador (só com ofertas cadastradas por perfil) ---- */
  els.tabs.hidden = categories.length < 2;
  els.tabs.innerHTML = [{ id: "", label: "Todos os perfis" }, ...categories]
    .map((c) => `<button type="button" class="tab" role="radio" data-cat="${c.id}">${escapeHTML(c.label)}</button>`)
    .join("");
  els.tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    state.category = b.dataset.cat;
    update(true);
  });

  /* ---- Painel de filtros ---- */
  els.form.innerHTML = `
    ${categories.length > 1 ? fieldset("Perfil de comprador", categories.map((c) => radio("category", c.id, c.label)).join("") + radio("category", "", "Todos")) : ""}
    ${groups.map((g) => fieldset(g.label, uniq(catalog.vehicles.map(g.value)).map((val) => check(g.key, val, g.text ? g.text(val, catalog) : val)).join(""))).join("")}
    ${types.length > 1 ? fieldset("Tipo de condição", types.map((t) => check("type", t.id, t.label)).join("")) : ""}
    ${hasReady ? fieldset("Disponibilidade", `<label class="opt"><input type="checkbox" name="ready" value="1"><span>Somente pronta entrega</span><span class="opt-count" data-count-for="ready:1"></span></label>`) : ""}
    ${priceSteps.length > 2 ? `<fieldset class="fgroup"><legend>Faixa de preço</legend>
      <div class="price-range">
        <label><span>De</span><select name="pmin"><option value="">Sem mínimo</option>${priceSteps.map((p) => `<option value="${p}">${fmtBRL(p)}</option>`).join("")}</select></label>
        <label><span>Até</span><select name="pmax"><option value="">Sem máximo</option>${priceSteps.map((p) => `<option value="${p}">${fmtBRL(p)}</option>`).join("")}</select></label>
      </div></fieldset>` : ""}
  `;
  els.sort.innerHTML = Object.entries(SORTS).filter(([k]) => hasPrices || !k.startsWith("preco")).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("");

  els.form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "category") state.category = t.value;
    else if (t.name === "ready") state.ready = t.checked;
    else if (t.name === "pmin" || t.name === "pmax") state[t.name] = t.value ? Number(t.value) : null;
    else if (Array.isArray(state[t.name])) {
      state[t.name] = t.checked ? [...state[t.name], t.value] : state[t.name].filter((x) => x !== t.value);
    }
    update(true);
  });
  els.sort.addEventListener("change", () => { state.sort = els.sort.value; update(false); });

  root.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => {
    Object.assign(state, emptyState(), { sort: state.sort });
    update(true);
  }));

  els.chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    const [key, val] = b.dataset.remove.split("|");
    if (key === "category") state.category = "";
    else if (key === "ready") state.ready = false;
    else if (key === "pmin" || key === "pmax") state[key] = null;
    else state[key] = state[key].filter((x) => x !== val);
    update(true);
  });

  bindCardColors(els.grid, catalog, (v) => offerFor(v, state));

  els.more.addEventListener("click", () => {
    const first = els.grid.children.length;
    visible += PAGE_SIZE;
    render();
    const next = els.grid.children[first];
    if (next) next.querySelector("a.card-title a, .card-title a")?.focus();
  });

  /* ---- Gaveta de filtros (telas menores) ---- */
  let release = null;
  const openPanel = () => {
    els.panel.classList.add("is-open");
    els.open.setAttribute("aria-expanded", "true");
    lockScroll(true);
    release = trapFocus(els.panel, closePanel);
    els.panel.querySelector("button, input")?.focus();
  };
  const closePanel = () => {
    if (!els.panel.classList.contains("is-open")) return;
    els.panel.classList.remove("is-open");
    els.open.setAttribute("aria-expanded", "false");
    lockScroll(false);
    if (release) release();
    els.open.focus();
  };
  els.open.addEventListener("click", openPanel);
  els.close.forEach((b) => b.addEventListener("click", closePanel));
  window.matchMedia("(min-width: 1100px)").addEventListener("change", (e) => e.matches && closePanel());

  /* ---- Filtragem ---- */
  function offerFor(v, s) {
    return pickOffer(v, { category: s.category, types: s.type }, catalog.defaultCategory);
  }

  function matches(v, s, skip) {
    for (const g of groups) {
      if (g.key !== skip && s[g.key].length && !s[g.key].includes(g.value(v))) return false;
    }
    if (skip !== "ready" && s.ready && v.availability !== "pronta-entrega") return false;
    const needsOffer = s.category || s.type.length || s.pmin != null || s.pmax != null;
    if (!needsOffer) return true;
    const sub = { ...s };
    if (skip === "category") sub.category = "";
    if (skip === "type") sub.type = [];
    const o = offerFor(v, sub);
    if ((sub.category || sub.type.length) && !o) return false;
    const price = knownPrice(v, o);
    if (s.pmin != null && (price == null || price < s.pmin)) return false;
    if (s.pmax != null && (price == null || price > s.pmax)) return false;
    return true;
  }

  function results() {
    const list = catalog.vehicles.filter((v) => matches(v, state)).map((v) => {
      const offer = offerFor(v, state);
      return { v, offer, price: knownPrice(v, offer), more: v.offers.filter((o) => o !== offer).length };
    });
    const sorter = SORTS[state.sort]?.fn;
    if (sorter) list.sort(sorter);
    else list.sort((a, b) => (b.v.id === featured) - (a.v.id === featured) || (b.v.edition === "night") - (a.v.edition === "night"));
    return list;
  }

  function facetCounts() {
    const out = {};
    for (const g of groups) {
      for (const val of uniq(catalog.vehicles.map(g.value))) {
        out[`${g.key}:${val}`] = catalog.vehicles.filter((v) => g.value(v) === val && matches(v, state, g.key)).length;
      }
    }
    // Tipo e perfil: conta como se aquela opção fosse a única marcada no grupo.
    for (const t of types) {
      out[`type:${t.id}`] = catalog.vehicles.filter((v) => matches(v, { ...state, type: [t.id] })).length;
    }
    for (const c of categories) {
      out[`category:${c.id}`] = catalog.vehicles.filter((v) => matches(v, { ...state, category: c.id })).length;
    }
    out["category:"] = catalog.vehicles.filter((v) => matches(v, { ...state, category: "" })).length;
    out["ready:1"] = catalog.vehicles.filter((v) => v.availability === "pronta-entrega" && matches(v, state, "ready")).length;
    return out;
  }

  function syncControls() {
    const counts = facetCounts();
    els.form.querySelectorAll("input").forEach((input) => {
      const key = `${input.name}:${input.value}`;
      if (input.name === "category") input.checked = state.category === input.value;
      else if (input.name === "ready") input.checked = state.ready;
      else input.checked = state[input.name].includes(input.value);
      const n = counts[key];
      const countEl = input.parentElement.querySelector(".opt-count");
      if (countEl && n != null) countEl.textContent = n;
      input.disabled = n === 0 && !input.checked;
    });
    els.form.querySelectorAll("select").forEach((s) => { s.value = state[s.name] ?? ""; });
    els.sort.value = state.sort;
    els.tabs.querySelectorAll("[data-cat]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.cat === state.category)));
  }

  function activeChips() {
    const chips = [];
    if (state.category) chips.push(["category", "", catalog.categoryById.get(state.category)?.label]);
    for (const g of groups) state[g.key].forEach((val) => chips.push([g.key, val, g.text ? g.text(val, catalog) : val]));
    state.type.forEach((t) => chips.push(["type", t, catalog.offerTypeById.get(t)?.label]));
    if (state.ready) chips.push(["ready", "", "Pronta entrega"]);
    if (state.pmin != null) chips.push(["pmin", "", `A partir de ${fmtBRL(state.pmin)}`]);
    if (state.pmax != null) chips.push(["pmax", "", `Até ${fmtBRL(state.pmax)}`]);
    return chips;
  }

  function render() {
    const list = results();
    const shown = list.slice(0, visible);
    els.grid.innerHTML = shown.length
      ? shown.map((r) => vehicleCard(catalog, r.v, r.offer, r.more)).join("")
      : `<div class="empty"><p class="h-card">Nenhuma versão com esses filtros.</p><p>Remova algum critério ou fale com um consultor: o estoque muda com frequência.</p><button type="button" class="btn btn--ghost" data-clear-inline>Limpar filtros</button></div>`;
    els.grid.querySelector("[data-clear-inline]")?.addEventListener("click", () => {
      Object.assign(state, emptyState(), { sort: state.sort });
      update(true);
    });
    const label = `${list.length} ${list.length === 1 ? "versão encontrada" : "versões encontradas"}`;
    els.count.forEach((el) => { el.textContent = label; });
    const remaining = list.length - shown.length;
    els.more.hidden = remaining <= 0;
    els.more.textContent = `Mostrar mais ${Math.min(remaining, PAGE_SIZE)} de ${remaining}`;

    const chips = activeChips();
    els.chips.innerHTML = chips.map(([k, val, text]) => `<button type="button" class="chip chip--remove" data-remove="${k}|${escapeHTML(val)}">${escapeHTML(text)}<span aria-hidden="true">×</span><span class="sr-only">remover filtro</span></button>`).join("");
    els.chips.hidden = !chips.length;
    root.querySelectorAll("[data-clear]").forEach((b) => { b.hidden = !chips.length; });
    els.badge.textContent = chips.length ? String(chips.length) : "";
  }

  function update(resetPage) {
    if (resetPage) visible = PAGE_SIZE;
    syncControls();
    render();
    writeURL(state);
  }

  /** Permite que outras seções (perfis, rodapé) apliquem um filtro e rolem até o catálogo. */
  document.addEventListener("catalog:filter", (e) => {
    Object.assign(state, emptyState(), e.detail || {});
    update(true);
    scrollToEl(root);
  });

  update(false);
  return state;
}

/* ---------- Helpers ---------- */

function uniq(arr) { return [...new Set(arr)]; }

function fieldset(legend, inner) {
  return `<fieldset class="fgroup"><legend>${escapeHTML(legend)}</legend><div class="opts">${inner}</div></fieldset>`;
}
function check(name, value, label) {
  return `<label class="opt"><input type="checkbox" name="${name}" value="${escapeHTML(value)}"><span>${escapeHTML(label)}</span><span class="opt-count" data-count-for="${name}:${escapeHTML(value)}"></span></label>`;
}
function radio(name, value, label) {
  return `<label class="opt"><input type="radio" name="${name}" value="${escapeHTML(value)}"><span>${escapeHTML(label)}</span><span class="opt-count"></span></label>`;
}

function buildPriceSteps(prices) {
  if (!prices.length) return [];
  const step = 50000;
  const lo = Math.floor(Math.min(...prices) / step) * step;
  const hi = Math.ceil(Math.max(...prices) / step) * step;
  const out = [];
  for (let p = lo; p <= hi; p += step) out.push(p);
  return out;
}

function readURL(state) {
  const q = new URLSearchParams(location.search);
  for (const g of GROUPS) if (q.get(g.param)) state[g.key] = q.get(g.param).split(",");
  if (q.get("t")) state.type = q.get("t").split(",");
  if (q.get("c")) state.category = q.get("c");
  if (q.get("pe") === "1") state.ready = true;
  if (q.get("pmin")) state.pmin = Number(q.get("pmin"));
  if (q.get("pmax")) state.pmax = Number(q.get("pmax"));
  if (q.get("o") && SORTS[q.get("o")]) state.sort = q.get("o");
  return state;
}

function writeURL(state) {
  const q = new URLSearchParams();
  for (const g of GROUPS) if (state[g.key].length) q.set(g.param, state[g.key].join(","));
  if (state.type.length) q.set("t", state.type.join(","));
  if (state.category) q.set("c", state.category);
  if (state.ready) q.set("pe", "1");
  if (state.pmin != null) q.set("pmin", state.pmin);
  if (state.pmax != null) q.set("pmax", state.pmax);
  if (state.sort !== "destaque") q.set("o", state.sort);
  const qs = q.toString();
  history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
}

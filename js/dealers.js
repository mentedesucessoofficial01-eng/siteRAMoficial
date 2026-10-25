import { escapeHTML, getSelectedDealerId, normalizeText, setSelectedDealerId, vehicleURL, whatsappURL } from "./core.js";
import { demoTag } from "./cards.js";

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Consulta pública de CEP (ViaCEP). Retorna cidade e UF, ou null. */
async function lookupCEP(cep) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const data = await r.json();
    return data.erro ? null : { city: data.localidade, uf: data.uf };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function mountDealers(root, catalog) {
  const form = root.querySelector("[data-dealer-form]");
  const input = form.querySelector("input");
  const status = root.querySelector("[data-dealer-status]");
  const list = root.querySelector("[data-dealer-list]");
  const geoBtn = root.querySelector("[data-geo]");
  const all = catalog.dealers;

  if (!all.length) {
    list.innerHTML = '<p class="empty">Nenhuma unidade cadastrada ainda.</p>';
    form.hidden = true;
    return;
  }

  function vehiclesServed(d) {
    if (d.vehicles === "all") return "Toda a linha";
    return d.vehicles.map((id) => catalog.vehicleById.get(id)).filter(Boolean)
      .map((v) => `<a href="${vehicleURL(v)}">${escapeHTML(v.fullName)}</a>`).join(", ");
  }

  function card(d, distance) {
    const selected = getSelectedDealerId() === d.id;
    const precise = d.coordsPrecision === "exata" && d.address;
    const route = precise ? `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}` : null;
    return `<article class="dealer${selected ? " is-selected" : ""}">
      <header>
        <h3 class="dealer-name">${escapeHTML(d.name)} ${demoTag(catalog)}</h3>
        <p class="dealer-city">${escapeHTML(d.city)} / ${escapeHTML(d.uf)}${distance != null ? ` · <span class="dealer-dist">≈ ${Math.round(distance)} km${precise ? "" : " do centro da cidade"}</span>` : ""}</p>
      </header>
      <dl class="dealer-info">
        ${d.address ? `<div><dt>Endereço</dt><dd>${escapeHTML(d.address)}</dd></div>` : ""}
        ${d.hours ? `<div><dt>Horário</dt><dd>${escapeHTML(d.hours)}</dd></div>` : ""}
        <div><dt>Atende</dt><dd>${vehiclesServed(d)}</dd></div>
      </dl>
      <div class="dealer-actions">
        <button type="button" class="btn ${selected ? "btn--accent" : "btn--ghost"}" data-select="${d.id}" aria-pressed="${selected}">${selected ? "Unidade escolhida" : "Atender por esta unidade"}</button>
        <a class="btn btn--wa" href="${whatsappURL(catalog, `Olá! Quero atendimento pela unidade de ${d.city}/${d.uf}.`, "unidade")}" target="_blank" rel="noopener">WhatsApp</a>
        ${route ? `<a class="btn btn--line" href="${route}" target="_blank" rel="noopener">Traçar rota</a>` : ""}
      </div>
    </article>`;
  }

  let current = all.map((d) => ({ d, distance: null }));

  function render(items, message) {
    current = items;
    status.textContent = message;
    list.innerHTML = items.length
      ? items.map(({ d, distance }) => card(d, distance)).join("")
      : '<p class="empty">Nenhuma unidade encontrada para essa busca. Tente o nome da cidade, a sigla do estado ou fale com o atendimento geral.</p>';
  }

  function rankByPlace(city, uf) {
    const c = normalizeText(city), u = normalizeText(uf);
    return all
      .map((d) => ({ d, score: (normalizeText(d.city) === c ? 2 : 0) + (normalizeText(d.uf) === u ? 1 : 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ d }) => ({ d, distance: null }));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return render(all.map((d) => ({ d, distance: null })), `${all.length} unidades cadastradas.`);
    const cep = q.replace(/\D/g, "");
    if (/^\d{8}$/.test(cep)) {
      status.textContent = "Consultando o CEP…";
      const place = await lookupCEP(cep);
      if (!place) return render([], "Não encontramos esse CEP. Confira os números ou busque pela cidade.");
      const found = rankByPlace(place.city, place.uf);
      return render(found, found.length ? `Unidades para ${place.city}/${place.uf}.` : `Ainda não há unidade em ${place.city}/${place.uf}.`);
    }
    const n = normalizeText(q);
    const found = all.filter((d) => [d.city, d.uf, d.region, d.name].some((f) => normalizeText(f).includes(n)))
      .map((d) => ({ d, distance: null }));
    render(found, `${found.length} ${found.length === 1 ? "unidade encontrada" : "unidades encontradas"} para “${q}”.`);
  });

  if (!("geolocation" in navigator)) geoBtn.hidden = true;
  geoBtn.addEventListener("click", () => {
    status.textContent = "Aguardando sua permissão de localização…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const items = all.map((d) => ({ d, distance: haversineKm(me, d) })).sort((a, b) => a.distance - b.distance);
        render(items, "Unidades ordenadas pela distância aproximada. Sua localização não é enviada nem armazenada.");
      },
      () => { status.textContent = "Sem acesso à localização. Digite seu CEP ou cidade no campo acima."; input.focus(); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });

  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-select]");
    if (!b) return;
    const id = b.dataset.select;
    setSelectedDealerId(getSelectedDealerId() === id ? null : id);
    render(current, status.textContent);
  });

  render(current, `${all.length} unidades cadastradas.`);
}

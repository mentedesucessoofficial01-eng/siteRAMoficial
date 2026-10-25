/**
 * Vitrine: uma versão por vez, com setas laterais, deslizar no celular,
 * teclado (← →), faixa de miniaturas, troca de cor e vídeo opcional da cor.
 *
 * A troca de cor usa fotos alinhadas entre si. Os vídeos de cada cor não têm
 * o mesmo movimento, por isso só tocam quando o visitante pede.
 */
import {
  escapeHTML, imageSlot, pickOffer, vehicleImages, vehicleMessage, vehicleURL, whatsappURL,
  yearsLabel, AVAILABILITY_LABEL,
} from "./core.js";
import { colorSwatches, priceBlock, swapImage } from "./cards.js";

const SIZES = "(min-width: 1024px) 62vw, 100vw";

export function mountShowroom(root, catalog) {
  if (!root) return;
  const featured = catalog.featuredVehicle;
  const list = [...catalog.vehicles].sort((a, b) =>
    (b.id === featured) - (a.id === featured) || (b.colors.length > 0) - (a.colors.length > 0));
  let index = 0;
  let colorId = list[0].colors[0]?.id || null;
  let motion = false;

  root.innerHTML = `
    <div class="sr-stage" data-sr-stage>
      <div class="sr-media" data-sr-media></div>
      <button type="button" class="sr-arrow sr-prev" data-sr-prev aria-label="Versão anterior"><span aria-hidden="true">←</span></button>
      <button type="button" class="sr-arrow sr-next" data-sr-next aria-label="Próxima versão"><span aria-hidden="true">→</span></button>
      <p class="sr-count" data-sr-count></p>
      <button type="button" class="sr-motion" data-sr-motion hidden></button>
    </div>
    <div class="sr-info" data-sr-info aria-live="polite"></div>
    <div class="sr-rail" data-sr-rail role="group" aria-label="Todas as versões" data-lenis-prevent>
      ${list.map((v, i) => `<button type="button" class="sr-thumb${v.edition === "night" ? " is-night" : ""}" data-sr-go="${i}" aria-label="${escapeHTML(v.fullName)}">
        <span class="sr-thumb-media">${imageSlot(vehicleImages(v)[0], { sizes: "160px" })}</span>
        <span class="sr-thumb-name"><span>${escapeHTML(v.modelRef.name)}</span>${escapeHTML(v.version)}</span>
      </button>`).join("")}
    </div>`;

  const els = {
    stage: root.querySelector("[data-sr-stage]"),
    media: root.querySelector("[data-sr-media]"),
    info: root.querySelector("[data-sr-info]"),
    count: root.querySelector("[data-sr-count]"),
    motion: root.querySelector("[data-sr-motion]"),
    rail: root.querySelector("[data-sr-rail]"),
  };

  const current = () => list[index];
  const currentColor = () => current().colors.find((c) => c.id === colorId) || current().colors[0] || null;

  function mediaItem() {
    const v = current();
    const color = currentColor();
    if (motion && color && color.video) {
      return { video: color.video, alt: `${v.fullName} ${color.name} em movimento`, illustrative: true, src: color.video.poster };
    }
    return vehicleImages(v, colorId)[0];
  }

  function renderInfo() {
    const v = current();
    const offer = pickOffer(v, {}, catalog.defaultCategory);
    const color = currentColor();
    els.info.innerHTML = `
      <p class="eyebrow">${escapeHTML(v.modelRef.name)} · ${escapeHTML(v.modelRef.segment)}</p>
      <h3 class="sr-title">${escapeHTML(v.version)}${v.edition === "night" ? ' <span class="night-mark night-mark--inline">Night Edition</span>' : ""}</h3>
      <p class="sr-spec">${yearsLabel(v)} · ${escapeHTML(v.engine)} · ${escapeHTML(v.traction)} · ${escapeHTML(AVAILABILITY_LABEL[v.availability])}</p>
      ${v.colors.length ? colorSwatches(v, colorId) : '<p class="sr-nocolor">Cores e fotos desta versão em breve.</p>'}
      ${priceBlock(catalog, offer, { vehicle: v, size: "lg" })}
      <div class="sr-ctas">
        <a class="btn btn--accent btn--lg" data-wa-placement="vitrine" data-wa-vehicle="${v.id}" href="${whatsappURL(catalog, vehicleMessage(catalog, v, offer, color && color.name), "vitrine")}" target="_blank" rel="noopener">Consultar condições</a>
        <a class="btn btn--ghost btn--lg" href="${vehicleURL(v)}">Ver detalhes</a>
      </div>`;
    els.count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
    const hasVideo = Boolean(color && color.video);
    els.motion.hidden = !hasVideo;
    els.motion.textContent = motion ? "■ Ver foto" : "▶ Ver em movimento";
    els.motion.setAttribute("aria-pressed", String(motion));
    els.rail.querySelectorAll("[data-sr-go]").forEach((b, i) => b.setAttribute("aria-current", String(i === index)));
    const thumb = els.rail.children[index];
    if (thumb) els.rail.scrollTo({ left: thumb.offsetLeft - els.rail.clientWidth / 2 + thumb.clientWidth / 2, behavior: "smooth" });
  }

  function render(first = false) {
    if (first) els.media.innerHTML = imageSlot(mediaItem(), { eager: false, sizes: SIZES, video: true });
    else swapImage(els.media, mediaItem(), SIZES, { video: true });
    els.stage.classList.toggle("is-night", current().edition === "night");
    renderInfo();
  }

  function go(i) {
    index = (i + list.length) % list.length;
    colorId = current().colors[0]?.id || null;
    motion = false;
    render();
  }

  root.querySelector("[data-sr-prev]").addEventListener("click", () => go(index - 1));
  root.querySelector("[data-sr-next]").addEventListener("click", () => go(index + 1));
  els.rail.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sr-go]");
    if (b) go(Number(b.dataset.srGo));
  });
  els.info.addEventListener("click", (e) => {
    const b = e.target.closest("[data-color]");
    if (!b || b.dataset.color === colorId) return;
    colorId = b.dataset.color;
    motion = false;
    render();
    els.info.querySelector(`[data-color="${colorId}"]`)?.focus();
  });
  els.motion.addEventListener("click", () => {
    motion = !motion;
    render();
  });

  root.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select, textarea")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
  });

  // Deslizar com o dedo no palco
  let startX = null, startY = null;
  els.stage.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { startX = e.clientX; startY = e.clientY; } });
  els.stage.addEventListener("pointerup", (e) => {
    if (startX == null) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
  });

  render(true);
}

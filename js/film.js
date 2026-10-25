/**
 * Sequência cinematográfica da Night Edition, guiada pelo scroll.
 *
 * Os frames vêm de frames/manifest.json (gerado por tools/extrair_frames.py).
 * Sem manifest, a mesma coreografia roda sobre o quadro de produção da foto
 * principal: o site continua completo e o vídeo entra depois sem mexer no código.
 */
import { reducedMotion } from "./core.js";

const FRAME_SPEED = 2.0;   // 1.8–2.2: a animação do produto termina por volta de 50% do scroll
const IMAGE_SCALE = 1;     // cover cheio: o vídeo é um cenário, não um produto em fundo liso (use 0.82–0.90 nesse caso)
const FIRST_BATCH = 10;

export async function initFilm(catalog) {
  const film = document.querySelector(".film");
  if (!film) return;
  const stage = film.querySelector(".film-stage");
  const canvasWrap = film.querySelector(".canvas-wrap");
  const canvas = film.querySelector("canvas");
  const overlay = film.querySelector(".dark-overlay");
  const hero = document.querySelector(".hero-standalone");
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;

  fillCounters(film, catalog);

  const manifest = await fetch("frames/manifest.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const hasFrames = Boolean(manifest && manifest.count > 0);
  film.classList.toggle("film--frames", hasFrames);

  if (reducedMotion || !gsap || !ST) {
    film.classList.add("film--static");
    if (hasFrames) {
      const img = new Image();
      img.src = framePath(manifest, manifest.count - 1);
      img.alt = "";
      img.className = "film-still";
      canvasWrap.replaceChildren(img);
    }
    return;
  }

  /* ---------- Frames ---------- */
  const ctx = canvas.getContext("2d");
  const frames = [];
  let current = -1;
  let bg = manifest?.bg || "#0a0a0b";

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(stage.clientWidth * dpr);
    canvas.height = Math.round(stage.clientHeight * dpr);
    if (current >= 0) draw(current);
  }

  function nearestLoaded(i) {
    for (let d = 0; d < frames.length; d++) {
      if (frames[i - d]?.complete && frames[i - d].naturalWidth) return frames[i - d];
      if (frames[i + d]?.complete && frames[i + d].naturalWidth) return frames[i + d];
    }
    return null;
  }

  function sampleBg(img) {
    const s = document.createElement("canvas");
    s.width = 8; s.height = 8;
    const c = s.getContext("2d", { willReadFrequently: true });
    c.drawImage(img, 0, 0, 8, 8);
    const data = c.getImageData(0, 0, 8, 8).data;
    const px = [[0, 0], [7, 0], [0, 7], [7, 7]].map(([x, y]) => data.subarray((y * 8 + x) * 4, (y * 8 + x) * 4 + 4));
    const avg = (k) => Math.round(px.reduce((a, p) => a + p[k], 0) / px.length);
    bg = `rgb(${avg(0)}, ${avg(1)}, ${avg(2)})`;
  }

  function draw(i) {
    const img = nearestLoaded(i);
    if (!img) return;
    if (i % 20 === 0) sampleBg(img);
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * IMAGE_SCALE;
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  if (hasFrames) {
    await preload(manifest, frames);
    resize();
    current = 0;
    draw(0);
    window.addEventListener("resize", resize);
    ST.create({
      trigger: film, start: "top top", end: "bottom bottom", scrub: true,
      onUpdate: (self) => {
        const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
        const index = Math.min(Math.floor(accelerated * manifest.count), manifest.count - 1);
        if (index !== current) {
          current = index;
          requestAnimationFrame(() => draw(current));
        }
      },
    });
  } else {
    // Sem vídeo: aproximação lenta do quadro de produção, no mesmo ritmo do scroll.
    gsap.fromTo(film.querySelector(".film-fallback"), { scale: 1.08 }, {
      scale: 1, ease: "none",
      scrollTrigger: { trigger: film, start: "top top", end: "50% bottom", scrub: true },
    });
  }

  /* ---------- Saída do hero + revelação circular ---------- */
  if (hero) {
    gsap.to(hero.querySelector(".hero-inner"), {
      opacity: 0, y: -80, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "70% top", scrub: true },
    });
  }
  ST.create({
    trigger: film, start: "top bottom", end: "top top", scrub: true,
    onUpdate: (self) => {
      canvasWrap.style.clipPath = `circle(${(self.progress * 75).toFixed(2)}% at 50% 50%)`;
    },
  });
  canvasWrap.style.clipPath = "circle(0% at 50% 50%)";

  /* ---------- Seções de texto ---------- */
  film.querySelectorAll(".scroll-section").forEach((section) => setupSection(section, film));

  /* ---------- Overlay escuro dos números ---------- */
  const stats = film.querySelector(".section-stats");
  if (stats) {
    const enter = Number(stats.dataset.enter) / 100;
    const leave = Number(stats.dataset.leave) / 100;
    const fade = 0.04;
    ST.create({
      trigger: film, start: "top top", end: "bottom bottom", scrub: true,
      onUpdate: ({ progress: p }) => {
        let o = 0;
        if (p >= enter - fade && p <= enter) o = ((p - (enter - fade)) / fade) * 0.9;
        else if (p > enter && p < leave) o = 0.9;
        else if (p >= leave && p <= leave + fade) o = 0.9 * (1 - (p - leave) / fade);
        overlay.style.opacity = o;
      },
    });
  }

  /* ---------- Letreiro horizontal ---------- */
  film.querySelectorAll(".marquee-wrap").forEach((wrap) => {
    const speed = Number(wrap.dataset.scrollSpeed) || -25;
    const enter = Number(wrap.dataset.enter) / 100;
    const leave = Number(wrap.dataset.leave) / 100;
    gsap.to(wrap.querySelector(".marquee-text"), {
      xPercent: speed, ease: "none",
      scrollTrigger: { trigger: film, start: "top top", end: "bottom bottom", scrub: true },
    });
    ST.create({
      trigger: film, start: "top top", end: "bottom bottom",
      onUpdate: ({ progress: p }) => {
        const fade = 0.03;
        let o = 0;
        if (p > enter && p < leave) o = Math.min(1, (p - enter) / fade, (leave - p) / fade);
        wrap.style.opacity = o;
      },
    });
  });

  ST.refresh();
}

function framePath(manifest, i) {
  const n = String(i + 1).padStart(4, "0");
  return `${manifest.dir || "frames"}/${(manifest.pattern || "frame_%04d.webp").replace("%04d", n)}`;
}

/** Duas fases: os primeiros frames liberam a tela; o resto carrega em segundo plano. */
function preload(manifest, frames) {
  const loader = document.getElementById("loader");
  const bar = document.getElementById("loader-bar");
  const pct = document.getElementById("loader-percent");
  if (loader) loader.hidden = false;
  let done = 0;
  const total = manifest.count;
  const tick = () => {
    done++;
    const p = Math.round((done / total) * 100);
    if (bar) bar.style.transform = `scaleX(${done / total})`;
    if (pct) pct.textContent = `${p}%`;
  };
  const load = (i) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { tick(); resolve(); };
    img.src = framePath(manifest, i);
    frames[i] = img;
  });

  const first = Array.from({ length: Math.min(FIRST_BATCH, total) }, (_, i) => load(i));
  return Promise.all(first).then(() => {
    (async () => {
      for (let i = FIRST_BATCH; i < total; i += 8) {
        await Promise.all(Array.from({ length: Math.min(8, total - i) }, (_, k) => load(i + k)));
      }
      loader?.classList.add("is-done");
    })();
    // A página fica utilizável após o primeiro lote; o desenho usa o frame carregado mais próximo.
    setTimeout(() => loader?.classList.add("is-done"), 400);
  });
}

function setupSection(section, film) {
  const gsap = window.gsap;
  const type = section.dataset.animation;
  const persist = section.dataset.persist === "true";
  const enter = Number(section.dataset.enter) / 100;
  const leave = Number(section.dataset.leave) / 100;
  const mid = (enter + leave) / 2;
  // Centraliza a seção na tela exatamente no meio da sua faixa de progresso.
  section.style.top = `calc(${mid} * (100% - 100vh) + 50vh)`;

  const children = section.querySelectorAll(".section-label, .section-heading, .section-body, .section-note, .cta-row, .stat");
  const tl = gsap.timeline({ paused: true });
  const base = { opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out" };
  switch (type) {
    case "slide-left": tl.from(children, { ...base, x: -80, stagger: 0.14 }); break;
    case "slide-right": tl.from(children, { ...base, x: 80, stagger: 0.14 }); break;
    case "scale-up": tl.from(children, { ...base, scale: 0.85, duration: 1, ease: "power2.out" }); break;
    case "rotate-in": tl.from(children, { ...base, y: 40, rotation: 3, stagger: 0.1 }); break;
    case "stagger-up": tl.from(children, { ...base, y: 60, stagger: 0.15, duration: 0.8 }); break;
    case "clip-reveal": tl.from(children, { ...base, clipPath: "inset(100% 0 0 0)", stagger: 0.15, duration: 1.2, ease: "power4.inOut" }); break;
    default: tl.from(children, { ...base, y: 50 });
  }

  const counters = [...section.querySelectorAll(".stat-number")].map((el) => ({ el, obj: { v: 0 } }));
  function playCounters() {
    counters.forEach(({ el, obj }) => {
      const target = Number(el.dataset.value);
      const dec = Number(el.dataset.decimals || 0);
      gsap.to(obj, {
        v: target, duration: 2, ease: "power1.out", overwrite: true,
        onUpdate: () => { el.textContent = obj.v.toFixed(dec).replace(".", ","); },
      });
    });
  }
  function resetCounters() {
    counters.forEach(({ el, obj }) => { gsap.killTweensOf(obj); obj.v = 0; el.textContent = "0"; });
  }
  resetCounters();

  let shown = false;
  window.ScrollTrigger.create({
    trigger: film, start: "top top", end: "bottom bottom",
    onUpdate: ({ progress: p }) => {
      const inside = p >= enter && p <= leave;
      const keep = persist && p > leave;
      if ((inside || keep) && !shown) {
        shown = true;
        section.classList.add("is-active");
        tl.play();
        playCounters();
      } else if (!inside && !keep && shown) {
        shown = false;
        section.classList.remove("is-active");
        tl.reverse();
        if (p < enter) resetCounters();
      }
    },
  });
}

/** Os números da seção de estatísticas são calculados a partir do catálogo, nunca digitados. */
function fillCounters(film, catalog) {
  const nightOffers = catalog.activeOffers.filter((o) => catalog.vehicleById.get(o.vehicle)?.edition === "night");
  const values = {
    models: new Set(catalog.vehicles.map((v) => v.model)).size,
    versions: catalog.vehicles.length,
    offers: catalog.activeOffers.length,
    profiles: catalog.buyerCategories.length,
    colors: catalog.vehicles.reduce((n, v) => n + v.colors.length, 0),
    night: catalog.vehicles.filter((v) => v.edition === "night").length,
    nightOffers: nightOffers.length,
  };
  film.querySelectorAll(".stat-number[data-source]").forEach((el) => {
    const v = values[el.dataset.source] ?? 0;
    el.dataset.value = String(v);
    el.textContent = String(v);
  });
}

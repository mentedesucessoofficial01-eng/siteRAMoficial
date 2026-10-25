import {
  boot, escapeHTML, fatal, imageSlot, initReveals, pickOffer, reducedMotion,
  vehicleImages, vehicleMessage, vehicleURL, whatsappURL,
} from "./core.js";
import { priceBlock } from "./cards.js";
import { mountLeadForm } from "./lead-form.js";
import { mountShowroom } from "./showroom.js";
import { initFilm } from "./film.js";

function splitHeroWords() {
  const h = document.querySelector(".hero-heading");
  if (!h || h.dataset.split) return;
  h.dataset.split = "1";
  h.querySelectorAll("[data-line]").forEach((line) => {
    line.innerHTML = line.textContent.trim().split(/\s+/).map((w) => `<span class="word"><span class="word-in">${escapeHTML(w)}</span></span>`).join(" ");
  });
  if (reducedMotion || !window.gsap) return;
  window.gsap.from(".hero-heading .word-in", { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.08, delay: 0.15 });
  window.gsap.from(".hero .section-label, .hero-tagline, .hero-ctas", { y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, delay: 0.5 });
}

/** Destaque editorial da Night Edition: vídeo da grade, frase, preço e duas chamadas. */
function renderNightDossier(catalog) {
  const root = document.querySelector("[data-night-dossier]");
  const v = catalog.vehicleById.get(catalog.featuredVehicle);
  if (!root || !v) return;
  const offer = pickOffer(v, {}, catalog.defaultCategory);
  const all = vehicleImages(v);
  const grille = all.find((i) => /grade/i.test(i.shot)) || all[0];
  const rest = all.filter((i) => i !== grille && !/estúdio/i.test(i.shot));
  const color = v.colors[0];

  root.innerHTML = `
    <div class="dossier-lead">
      <figure class="dossier-grille" data-reveal-item>
        ${imageSlot(grille, { sizes: "(min-width: 1100px) 60vw, 100vw", video: true })}
        <figcaption>Grade frontal totalmente preta</figcaption>
      </figure>
      <div class="dossier-copy">
        <p class="eyebrow" data-reveal-item>004 / Em destaque</p>
        <h2 class="h-section" data-reveal-item>${escapeHTML(v.fullName)}</h2>
        <p class="lede" data-reveal-item>${escapeHTML(v.summary)}</p>
        <ul class="dossier-points" data-reveal-item>${v.highlights.map((h) => `<li>${escapeHTML(h)}</li>`).join("")}</ul>
        <div data-reveal-item>${priceBlock(catalog, offer, { size: "lg", vehicle: v })}</div>
        <div class="cta-row" data-reveal-item>
          <a class="btn btn--accent btn--lg" data-wa-vehicle="${v.id}" href="${whatsappURL(catalog, vehicleMessage(catalog, v, offer, color && color.name), "dossie")}" target="_blank" rel="noopener">Consultar condições</a>
          <a class="btn btn--ghost btn--lg" href="${vehicleURL(v)}">Ver todas as fotos</a>
        </div>
      </div>
    </div>
    ${rest.length ? `<div class="dossier-strip">
      ${rest.map((img) => `<figure class="dossier-shot">${imageSlot(img, { sizes: "(min-width: 900px) 33vw, 80vw", video: true })}<figcaption>${escapeHTML(img.shot)}</figcaption></figure>`).join("")}
    </div>` : ""}`;

  // CTA final da sequência fala da mesma versão
  document.querySelectorAll("[data-featured-wa]").forEach((a) => {
    a.href = whatsappURL(catalog, `Olá! Vi a ${v.fullName} no site e quero saber o preço e as condições.`, "sequencia-night");
    a.dataset.waVehicle = v.id;
  });
  document.querySelectorAll("[data-featured-name]").forEach((el) => { el.textContent = v.fullName; });
}

boot()
  .then(async (catalog) => {
    splitHeroWords();
    mountShowroom(document.querySelector("[data-showroom]"), catalog);
    renderNightDossier(catalog);
    mountLeadForm(document.getElementById("lead-home"), catalog, { idPrefix: "lh" });
    await initFilm(catalog);
    initReveals();
    if (location.hash) {
      const t = document.getElementById(location.hash.slice(1));
      if (t) setTimeout(() => t.scrollIntoView(), 50);
    }
  })
  .catch((err) => {
    console.error(err);
    fatal(err.message);
  });

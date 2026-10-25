import { escapeHTML, getSelectedDealerId, scrollToEl, whatsappURL, yearsLabel } from "./core.js";

/* ---------- Máscara e validação ---------- */

const digits = (s) => String(s).replace(/\D/g, "");

export const masks = {
  phone(v) {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  },
};

/* ---------- Formulário ---------- */

/**
 * Pedido de proposta curto. Sem backend, ao enviar abre o WhatsApp com a
 * mensagem pronta; com `leads.endpoint`, grava o pedido e oferece o WhatsApp.
 * @param {HTMLElement} root
 * @param {object} catalog
 * @param {{ vehicleId?: string, offerId?: string, colorName?: string, idPrefix?: string, placement?: string }} opts
 */
export function mountLeadForm(root, catalog, opts = {}) {
  const p = opts.idPrefix || "lead";
  const controller = catalog.operation.privacyController || catalog.operation.legalName;

  root.innerHTML = `
  <form class="lead" novalidate>
    <div class="lead-errors" role="alert" tabindex="-1" hidden></div>
    <div class="lead-grid">
      <div class="field field--wide">
        <label class="field-label" for="${p}-name">Seu nome</label>
        <input id="${p}-name" name="name" autocomplete="name" required>
        <span class="field-error" id="${p}-name-err"></span>
      </div>
      <div class="field">
        <label class="field-label" for="${p}-phone">WhatsApp com DDD</label>
        <input id="${p}-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(00) 00000-0000" required>
        <span class="field-error" id="${p}-phone-err"></span>
      </div>
      <div class="field">
        <label class="field-label" for="${p}-city">Cidade</label>
        <input id="${p}-city" name="city" autocomplete="address-level2" required>
        <span class="field-error" id="${p}-city-err"></span>
      </div>
      <div class="field field--wide">
        <label class="field-label" for="${p}-vehicle">Versão de interesse</label>
        <select id="${p}-vehicle" name="vehicle">
          <option value="">Ainda não sei</option>
          ${catalog.vehicles.map((v) => `<option value="${v.id}">${escapeHTML(v.fullName)}</option>`).join("")}
        </select>
      </div>
      <div class="field field--wide">
        <label class="field-label" for="${p}-msg">Mensagem <span class="field-opt">(opcional)</span></label>
        <textarea id="${p}-msg" name="message" rows="2" maxlength="400"></textarea>
      </div>
      <input type="hidden" name="offer">
      <input type="hidden" name="color">
    </div>

    <div class="lead-actions">
      <button type="submit" class="btn btn--accent btn--lg">Pedir proposta no WhatsApp</button>
    </div>
    <p class="lead-legal">${escapeHTML(catalog.leads.privacyNotice)}${controller ? ` Responsável pelo tratamento: <strong>${escapeHTML(controller)}</strong>.` : ""} <a href="privacidade.html">Aviso de privacidade</a>.</p>
  </form>
  <div class="lead-result" hidden tabindex="-1"></div>`;

  const form = root.querySelector("form");
  const el = form.elements;
  const result = root.querySelector(".lead-result");
  const errorsBox = form.querySelector(".lead-errors");

  /** Preenche versão, oferta, cor e observação (vindo da vitrine, do destaque ou da página da versão). */
  function prefill({ vehicleId, offerId, text, colorName } = {}) {
    if (vehicleId && catalog.vehicleById.has(vehicleId)) el.vehicle.value = vehicleId;
    el.offer.value = offerId || "";
    el.color.value = colorName || "";
    if (text) el.message.value = text;
  }

  el.vehicle.addEventListener("change", () => { el.offer.value = ""; el.color.value = ""; });
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.name === "phone") t.value = masks.phone(t.value);
    if (t.getAttribute("aria-invalid") === "true") validateField(t.name);
  });
  form.addEventListener("focusout", (e) => {
    if (e.target.name && e.target.value) validateField(e.target.name);
  });

  const rules = {
    name: () => (el.name.value.trim().length < 2 ? "Informe seu nome." : ""),
    phone: () => { const d = digits(el.phone.value); return d.length !== 11 ? "Informe o WhatsApp com DDD (11 dígitos)." : (d[2] !== "9" ? "O número de WhatsApp começa com 9 após o DDD." : ""); },
    city: () => (el.city.value.trim().length < 2 ? "Informe sua cidade." : ""),
  };

  function validateField(name) {
    if (!rules[name]) return "";
    const msg = rules[name]();
    const input = el[name];
    const err = form.querySelector(`#${p}-${name}-err`);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg) input.setAttribute("aria-describedby", err.id);
    else input.removeAttribute("aria-describedby");
    err.textContent = msg;
    return msg;
  }

  function collect() {
    /** @type {import('./core.js').Lead} */
    return {
      name: el.name.value.trim(),
      phone: el.phone.value,
      city: el.city.value.trim(),
      vehicle: el.vehicle.value || undefined,
      offer: el.offer.value || undefined,
      color: el.color.value || undefined,
      message: el.message.value.trim() || undefined,
      dealer: getSelectedDealerId() || undefined,
      createdAt: new Date().toISOString(),
    };
  }

  function leadMessage(lead) {
    const v = catalog.vehicleById.get(lead.vehicle);
    return [
      `Olá! Sou ${lead.name}, de ${lead.city}, e quero receber uma proposta.`,
      `Interesse: ${v ? `${v.fullName} ${yearsLabel(v)}` : "ainda estou escolhendo"}${lead.color ? `, cor ${lead.color}` : ""}.`,
      lead.message && `Observação: ${lead.message}`,
      `Meu WhatsApp: ${lead.phone}`,
    ].filter(Boolean).join("\n");
  }

  function showResult(html) {
    form.hidden = true;
    result.hidden = false;
    result.innerHTML = html;
    result.focus();
    result.querySelector("[data-edit]")?.addEventListener("click", () => {
      result.hidden = true;
      form.hidden = false;
      el.name.focus();
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errors = Object.keys(rules).map((n) => [n, validateField(n)]).filter(([, m]) => m);
    if (errors.length) {
      errorsBox.hidden = false;
      errorsBox.innerHTML = `<p><strong>Revise ${errors.length === 1 ? "1 campo" : `${errors.length} campos`}:</strong></p><ul>${errors.map(([n, m]) => `<li><a href="#${el[n].id}">${escapeHTML(m)}</a></li>`).join("")}</ul>`;
      el[errors[0][0]].focus();
      return;
    }
    errorsBox.hidden = true;
    const lead = collect();
    const waURL = whatsappURL(catalog, leadMessage(lead), opts.placement || "formulario");

    if (!catalog.leads.endpoint) {
      // Abre o WhatsApp no mesmo clique do envio; o painel fica como plano B se o navegador bloquear.
      window.open(waURL, "_blank", "noopener");
      showResult(`
        <p class="eyebrow">Quase lá</p>
        <h3 class="h-card">Sua mensagem está pronta no WhatsApp.</h3>
        <p>Confira e toque em enviar. O WhatsApp não abriu? Use o botão abaixo.</p>
        <div class="lead-actions">
          <a class="btn btn--wa btn--lg" href="${waURL}" target="_blank" rel="noopener">Abrir WhatsApp</a>
          <button type="button" class="btn btn--ghost" data-edit>Editar dados</button>
        </div>`);
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Enviando…";
    try {
      const res = await fetch(catalog.leads.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      if (!res.ok) throw new Error(String(res.status));
      showResult(`
        <p class="eyebrow">Solicitação recebida</p>
        <h3 class="h-card">Obrigado, ${escapeHTML(lead.name.split(" ")[0])}.</h3>
        <p>Um consultor vai responder pelo WhatsApp informado. Se preferir adiantar, fale agora.</p>
        <div class="lead-actions"><a class="btn btn--wa" href="${waURL}" target="_blank" rel="noopener">Abrir WhatsApp</a></div>`);
    } catch {
      errorsBox.hidden = false;
      errorsBox.innerHTML = `<p><strong>Não conseguimos enviar agora.</strong> Seus dados continuam no formulário. Tente de novo ou <a href="${waURL}" target="_blank" rel="noopener">envie pelo WhatsApp</a>.</p>`;
      errorsBox.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = "Pedir proposta no WhatsApp";
    }
  });

  prefill({ vehicleId: opts.vehicleId, offerId: opts.offerId, colorName: opts.colorName });

  document.addEventListener("lead:prefill", (e) => {
    if (!result.hidden) { result.hidden = true; form.hidden = false; }
    prefill(e.detail || {});
    scrollToEl(root.closest("section") || root);
    setTimeout(() => el.name.focus({ preventScroll: true }), 600);
  });
}

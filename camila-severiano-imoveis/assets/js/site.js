/* Site público — listagem, filtros, modal do imóvel e captura de leads. */
(async function () {
  'use strict';
  const { U } = window.CS;
  const store = await window.CS.ready;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  let settings = await store.getSettings().catch(() => ({ ...window.CS_CONFIG }));
  let props = [];
  try { props = (await store.listProperties()).filter((p) => p.published !== false); }
  catch (e) { console.error(e); }

  const state = { type: '', region: '', max: '', beds: '', text: '', sort: 'featured' };

  /* ---------- Contatos e textos dinâmicos ---------- */
  function applySettings() {
    $$('[data-wa]').forEach((a) => { a.href = U.wa(settings.whatsapp, a.dataset.wa); });
    $$('.instaHandle').forEach((a) => { a.href = 'https://instagram.com/' + settings.instagram; a.textContent = '@' + settings.instagram; });
    const ig = $('#instaLink'); if (ig) { ig.href = 'https://instagram.com/' + settings.instagram; ig.lastChild.textContent = ' @' + settings.instagram; }
    $$('[data-set="city"]').forEach((e) => (e.textContent = settings.city));
    $$('[data-set="phone"]').forEach((e) => (e.textContent = U.phoneFmt(settings.whatsapp)));
    $$('[data-set="creci"]').forEach((e) => (e.textContent = settings.creci));
    $$('[data-set="emailLink"]').forEach((e) => { e.textContent = settings.email; e.href = 'mailto:' + settings.email; });
    $('#year').textContent = new Date().getFullYear();
  }
  applySettings();

  /* ---------- Imagens com reserva elegante ---------- */
  function guardImg(img, type, seed, bare) {
    const fail = () => { if (!img.dataset.failed) { img.dataset.failed = 1; img.src = U.placeholder(type, seed, bare); } };
    img.addEventListener('error', fail, { once: true });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail(); // falhou antes do script rodar
  }
  $$('img[data-ph]').forEach((img) => guardImg(img, img.dataset.ph, img.dataset.ph, true));
  // Retrato recortado da Camila no hero (assets/img/camila-hero.png); sem ele, mostra o cartão da marca
  const heroCam = $('#heroCamila');
  const noHeroPhoto = () => { heroCam.hidden = true; heroCam.style.display = 'none'; $('.hero__side').classList.add('no-photo'); };
  heroCam.addEventListener('error', noHeroPhoto, { once: true });
  if (heroCam.complete && heroCam.naturalWidth === 0) noHeroPhoto();
  const photo = $('#camilaPhoto');
  const noPhoto = () => { if (photo.parentElement) photo.parentElement.innerHTML = '<div class="portrait-fallback"><svg viewBox="0 0 120 110" style="color:var(--gold)"><use href="#i-mark"/></svg></div>'; };
  photo.addEventListener('error', noPhoto, { once: true });
  if (photo.complete && photo.naturalWidth === 0) noPhoto();

  /* ---------- Opções de selects ---------- */
  const types = [...new Set([...U.TYPES.filter((t) => props.some((p) => p.type === t)), ...props.map((p) => p.type)])];
  const regions = [...new Set([...U.REGIONS, ...props.map((p) => p.region)])].filter(Boolean);
  const opt = (v) => `<option value="${U.esc(v)}">${U.esc(v)}</option>`;
  $$('select[name="type"]').forEach((s) => s.insertAdjacentHTML('beforeend', U.TYPES.map(opt).join('')));
  $$('select[name="region"], #fRegion').forEach((s) => s.insertAdjacentHTML('beforeend', regions.map(opt).join('')));

  $('#typeChips').innerHTML = ['', ...types].map((t) =>
    `<button class="chip${t === '' ? ' is-on' : ''}" data-type="${U.esc(t)}" role="tab">${t ? U.esc(t) : 'Todos'}</button>`).join('');

  /* ---------- Filtro ---------- */
  function matches(p) {
    if (state.type && p.type !== state.type) return false;
    if (state.region && p.region !== state.region) return false;
    if (state.max && (p.price || 0) > +state.max) return false;
    if (state.beds && (p.bedrooms || 0) < +state.beds) return false;
    if (state.text) {
      const hay = U.norm([p.title, p.code, p.region, p.neighborhood, p.type, (p.features || []).join(' ')].join(' '));
      if (!U.norm(state.text).split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  const statusRank = (p) => (p.status === 'Vendido' ? 2 : p.status === 'Reservado' ? 1 : 0);
  function sorted(list) {
    const l = [...list];
    const by = {
      featured: (a, b) => statusRank(a) - statusRank(b) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || new Date(b.createdAt) - new Date(a.createdAt),
      new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      asc: (a, b) => (a.price || 0) - (b.price || 0),
      desc: (a, b) => (b.price || 0) - (a.price || 0)
    };
    return l.sort(by[state.sort] || by.featured);
  }

  function card(p) {
    const specs = [];
    if (p.bedrooms) specs.push(`<span><svg class="ic"><use href="#i-bed"/></svg>${p.bedrooms} qto${p.bedrooms > 1 ? 's' : ''}</span>`);
    if (p.suites) specs.push(`<span><svg class="ic"><use href="#i-bath"/></svg>${p.suites} suíte${p.suites > 1 ? 's' : ''}</span>`);
    if (p.parking) specs.push(`<span><svg class="ic"><use href="#i-car"/></svg>${p.parking}</span>`);
    const a = p.area || p.land;
    if (a) specs.push(`<span><svg class="ic"><use href="#i-area"/></svg>${a} m²</span>`);
    const badges = [];
    if (p.status && p.status !== 'Disponível') badges.push(`<span class="badge badge--ink">${U.esc(p.status)}</span>`);
    if (p.featured) badges.push('<span class="badge badge--gold">Destaque</span>');
    badges.push(`<span class="badge">${U.esc(p.type)}</span>`);
    return `<button class="pcard reveal${p.status === 'Vendido' ? ' is-sold' : ''}" data-id="${U.esc(p.id)}" aria-label="${U.esc(p.title)}">
      <div class="pcard__img"><img loading="lazy" src="${U.esc(U.cover(p))}" alt="" data-type="${U.esc(p.type)}" data-seed="${U.esc(p.id)}">
        <div class="pcard__badges">${badges.join('')}</div><span class="pcard__code">${U.esc(p.code || '')}</span></div>
      <div class="pcard__body">
        <span class="pcard__loc"><svg class="ic"><use href="#i-pin"/></svg>${U.esc(p.region)}</span>
        <h3>${U.esc(p.title)}</h3>
        <div class="pcard__specs">${specs.join('')}</div>
        <div class="pcard__foot"><span class="pcard__price">${U.brl(p.price)}</span><span class="pcard__more"><svg class="ic"><use href="#i-arrow"/></svg></span></div>
      </div></button>`;
  }

  function render() {
    const list = sorted(props.filter(matches));
    $('#grid').innerHTML = list.map(card).join('');
    $$('#grid img').forEach((img) => guardImg(img, img.dataset.type, img.dataset.seed));
    $('#empty').hidden = list.length > 0;
    $('#count').textContent = list.length ? `${list.length} ${list.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}` : '';
    observeReveal();
  }

  function setFilter(k, v) {
    state[k] = v;
    if (k === 'type') $$('.chip').forEach((c) => c.classList.toggle('is-on', c.dataset.type === v));
    if (k === 'region') $('#fRegion').value = v;
    if (k === 'max') $('#fMax').value = v;
    if (k === 'beds') $('#fBeds').value = v;
    render();
  }

  $('#typeChips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) setFilter('type', b.dataset.type); });
  $('#fRegion').addEventListener('change', (e) => setFilter('region', e.target.value));
  $('#fMax').addEventListener('change', (e) => setFilter('max', e.target.value));
  $('#fBeds').addEventListener('change', (e) => setFilter('beds', e.target.value));
  $('#fSort').addEventListener('change', (e) => setFilter('sort', e.target.value));
  let t; $('#fText').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => setFilter('text', e.target.value.trim()), 180); });

  const gotoRegion = (r) => { setFilter('type', ''); setFilter('region', r); $('#imoveis').scrollIntoView({ behavior: 'smooth' }); };
  $$('.region').forEach((el) => el.addEventListener('click', () => gotoRegion(el.dataset.region)));
  $$('[data-goto-region]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); gotoRegion(el.dataset.gotoRegion); }));

  /* ---------- Modal do imóvel ---------- */
  const modal = $('#propModal');
  let lastFocus = null;

  function openProperty(id) {
    const p = props.find((x) => x.id === id);
    if (!p) return;
    lastFocus = document.activeElement;
    const photos = (p.photos && p.photos.length) ? p.photos : [U.placeholder(p.type, p.id)];
    const spec = (v, l) => `<div><b>${v || '—'}</b><small>${l}</small></div>`;
    $('#pmBody').innerHTML = `
      <div class="pm__gal">
        <img class="pm__main" id="pmMain" src="${U.esc(photos[0])}" alt="${U.esc(p.title)}">
        ${photos.length > 1 ? `<button class="pm__nav pm__nav--p" data-step="-1" aria-label="Foto anterior"><svg class="ic"><use href="#i-arrow"/></svg></button>
        <button class="pm__nav pm__nav--n" data-step="1" aria-label="Próxima foto"><svg class="ic"><use href="#i-arrow"/></svg></button>
        <div class="pm__thumbs">${photos.map((ph, i) => `<button data-i="${i}" class="${i ? '' : 'is-on'}" aria-label="Foto ${i + 1}"><img src="${U.esc(ph)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="pm__info">
        <span class="pcard__loc"><svg class="ic"><use href="#i-pin"/></svg>${U.esc(p.region)}${p.neighborhood ? ' · ' + U.esc(p.neighborhood) : ''}</span>
        <h2 id="pmTitle">${U.esc(p.title)}</h2>
        <div class="pm__price">${U.brl(p.price)} <small style="font-family:var(--sans);font-size:13px;color:var(--muted);font-weight:600">${U.esc(p.code || '')}${p.status && p.status !== 'Disponível' ? ' · ' + U.esc(p.status) : ''}</small></div>
        <div class="pm__specs">${p.bedrooms ? spec(p.bedrooms, 'Quartos') : spec(p.land ? p.land + 'm²' : '', 'Terreno')}${spec(p.suites, 'Suítes')}${spec(p.parking, 'Vagas')}${spec((p.area || p.land) ? (p.area || p.land) + 'm²' : '', p.area ? 'Área' : 'Terreno')}</div>
        <p class="pm__desc">${U.esc(p.description || '')}</p>
        ${(p.features || []).length ? `<div class="pm__feat">${p.features.map((f) => `<span>${U.esc(f)}</span>`).join('')}</div>` : ''}
        <div class="pm__cta">
          <form class="pm__form" id="pmForm" novalidate>
            <p>Quer visitar ou receber mais fotos e a planta?</p>
            <div class="row"><input name="name" placeholder="Seu nome" autocomplete="name" required><input name="phone" placeholder="WhatsApp" inputmode="tel" autocomplete="tel" required></div>
            <button class="btn btn--wa btn--block" type="submit"><svg class="ic"><use href="#i-chat"/></svg> Tenho interesse: falar no WhatsApp</button>
          </form>
        </div>
      </div>`;
    $$('#pmBody img').forEach((img) => guardImg(img, p.type, p.id));
    let cur = 0;
    const show = (i) => {
      cur = (i + photos.length) % photos.length;
      $('#pmMain').src = photos[cur];
      $$('.pm__thumbs button').forEach((b, j) => b.classList.toggle('is-on', j === cur));
    };
    $('#pmBody').onclick = (e) => {
      const th = e.target.closest('[data-i]'); if (th) show(+th.dataset.i);
      const st = e.target.closest('[data-step]'); if (st) show(cur + +st.dataset.step);
    };
    $('#pmForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target; const name = f.name.value.trim(); const phone = U.digits(f.phone.value);
      f.name.classList.toggle('is-invalid', !name); f.phone.classList.toggle('is-invalid', phone.length < 10);
      if (!name || phone.length < 10) return;
      const win = window.open('', '_blank'); // abre já no clique (evita bloqueio de pop-up)
      await saveLead({ name, phone, source: 'Site · Imóvel', propertyId: p.id, propertyTitle: `${p.code} · ${p.title}`, interest: { type: p.type, region: p.region, maxPrice: p.price, bedrooms: p.bedrooms } });
      const msg = `Olá, Camila! Sou ${name}. Vi no seu site o imóvel *${p.code} · ${p.title}* (${p.region}, ${U.brl(p.price)}) e tenho interesse. Podemos conversar?`;
      const url = U.wa(settings.whatsapp, msg);
      if (win) win.location.href = url; else location.href = url;
    });
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.modal__x', modal).focus();
  }
  function closeModal() {
    modal.hidden = true; document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  $('#grid').addEventListener('click', (e) => { const c = e.target.closest('.pcard'); if (c) openProperty(c.dataset.id); });

  /* ---------- Leads ---------- */
  async function saveLead(data) {
    const lead = { stage: 'novo', notes: [], email: '', message: '', ...data };
    Object.assign(lead, U.scoreLead(lead));
    try { return await store.createLead(lead); }
    catch (e) { console.error('Lead não salvo no CRM:', e); return lead; }
  }

  $('#leadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const msg = $('#leadMsg');
    const name = f.name.value.trim(); const phone = U.digits(f.phone.value);
    f.name.classList.toggle('is-invalid', !name); f.phone.classList.toggle('is-invalid', phone.length < 10);
    msg.classList.remove('err');
    if (!name || phone.length < 10) { msg.textContent = 'Preencha seu nome e um WhatsApp válido com DDD.'; msg.classList.add('err'); return; }
    if (!f.consent.checked) { msg.textContent = 'Marque a autorização de contato para continuar.'; msg.classList.add('err'); return; }
    const interest = { purpose: f.purpose.value, type: f.type.value, region: f.region.value, maxPrice: +f.maxPrice.value || null };
    const win = window.open('', '_blank');
    await saveLead({ name, phone, message: f.message.value.trim(), source: 'Site · Formulário', interest });
    const parts = [interest.type || 'um imóvel', interest.region ? 'em ' + interest.region : '', interest.maxPrice ? 'até ' + U.brlShort(interest.maxPrice) : '', 'para ' + interest.purpose.toLowerCase()].filter(Boolean).join(' ');
    const text = `Olá, Camila! Sou ${name}. Procuro ${parts}.${f.message.value.trim() ? ' ' + f.message.value.trim() : ''}`;
    const url = U.wa(settings.whatsapp, text);
    if (win) win.location.href = url; else location.href = url;
    msg.textContent = 'Recebido! Abrimos o WhatsApp para você falar com a Camila.';
    f.reset();
  });

  /* ---------- Navegação ---------- */
  const nav = $('.nav');
  const secs = ['top', 'imoveis', 'metodo', 'regioes', 'sobre', 'contato'].map((id) => document.getElementById(id)).filter(Boolean);
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', scrollY > 30);
    let cur = 'top';
    secs.forEach((sec) => { if (sec.id !== 'top' && sec.getBoundingClientRect().top < 140) cur = sec.id; });
    $$('#navLinks a').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + cur));
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const burger = $('#burger'); const links = $('#navLinks');
  burger.addEventListener('click', () => { const o = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', o); });
  links.addEventListener('click', (e) => { if (e.target.closest('a')) { links.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); } });

  /* ---------- Revelação ao rolar ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' }) : null;
  function observeReveal() {
    $$('.reveal:not(.is-in)').forEach((el, i) => {
      if (!io) return el.classList.add('is-in');
      el.style.transitionDelay = Math.min(i % 6, 5) * 60 + 'ms';
      io.observe(el);
    });
  }

  render();

  /* API para a assistente */
  window.CS_SITE = { props: () => props, settings: () => settings, openProperty, saveLead, setFilter };
  document.dispatchEvent(new CustomEvent('cs:ready'));
})();

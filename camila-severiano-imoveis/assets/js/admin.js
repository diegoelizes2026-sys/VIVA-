/* Painel da corretora — login, painel, CRM (funil), imóveis e configurações. */
(async function () {
  'use strict';
  const { U } = window.CS;
  const store = await window.CS.ready;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const STAGE = Object.fromEntries(U.STAGES.map((s) => [s.id, s]));

  let props = [], leads = [], settings = {};
  const lv = { view: 'board', q: '', temp: '' };

  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('is-on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-on'), 2600); };
  const guard = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { console.error(e); toast(e.message || 'Algo deu errado.'); throw e; } };

  /* ---------------- LOGIN ---------------- */
  async function boot() {
    if (await store.isSignedIn()) return enter();
    const setup = store.needsSetup();
    $('#login').hidden = false;
    $('#emailWrap').hidden = store.mode !== 'supabase';
    $('#pass2Wrap').hidden = !setup;
    $('#loginTitle').textContent = setup ? 'Crie sua senha de acesso' : 'Entrar no painel';
    $('#loginHint').textContent = setup
      ? 'Primeiro acesso: defina uma senha (mínimo 6 caracteres) para proteger o painel neste navegador.'
      : store.mode === 'supabase' ? 'Use o e-mail e a senha cadastrados no Supabase.' : 'Digite sua senha de acesso.';
    $('.login__box button[type=submit]').textContent = setup ? 'Criar senha e entrar' : 'Entrar';
    $('#loginForm [name=password]').focus();
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const err = $('#loginErr'); err.textContent = '';
    try {
      if (store.needsSetup()) {
        if (f.password.value.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        if (f.password.value !== f.password2.value) throw new Error('As senhas não conferem.');
        await store.setPassword(f.password.value);
      } else {
        await store.signIn(f.email.value.trim(), f.password.value);
      }
      $('#login').hidden = true; f.reset(); enter();
    } catch (ex) { err.textContent = ex.message; }
  });
  $('#logout').addEventListener('click', async () => { await store.signOut(); location.reload(); });

  async function enter() {
    $('#app').hidden = false;
    $('#modeTag').innerHTML = store.mode === 'supabase'
      ? '<b>● Nuvem (Supabase)</b><br>Dados sincronizados em todos os dispositivos.'
      : '<b>● Modo local</b><br>Dados salvos neste navegador. Conecte o Supabase para produção.';
    $('#modeHelp').textContent = store.mode === 'supabase'
      ? 'Seus dados estão na nuvem. Ainda assim, baixe um backup de vez em quando.'
      : 'Modo local: imóveis e leads ficam salvos apenas neste navegador. Baixe backups com frequência e conecte o Supabase (veja o README) para o site mostrar suas alterações a todos os visitantes e receber leads de qualquer lugar.';
    $('#passBox').hidden = store.mode === 'supabase';
    await reload();
    route();
  }

  async function reload() {
    [props, leads, settings] = await Promise.all([store.listProperties(), store.listLeads(), store.getSettings()]);
    renderAll();
  }
  function renderAll() {
    const h = new Date().getHours();
    $('#hello').textContent = `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, ${String(settings.name || 'Camila').split(' ')[0]}`;
    const novos = leads.filter((l) => l.stage === 'novo').length;
    $('#newCount').hidden = !novos; $('#newCount').textContent = novos;
    renderDash(); renderCRM(); renderProps(); fillSettings();
  }

  /* ---------------- ROTAS ---------------- */
  function route() {
    const v = (location.hash || '#painel').slice(1);
    const view = ['painel', 'crm', 'imoveis', 'ajustes'].includes(v) ? v : 'painel';
    $$('.view').forEach((s) => (s.hidden = s.dataset.view !== view));
    $$('.side__nav a').forEach((a) => a.classList.toggle('is-on', a.dataset.view === view));
    window.scrollTo(0, 0);
  }
  addEventListener('hashchange', route);

  /* ---------------- PAINEL ---------------- */
  function renderDash() {
    const active = props.filter((p) => p.published !== false && p.status !== 'Vendido');
    const weekAgo = Date.now() - 7 * 864e5;
    const week = leads.filter((l) => new Date(l.createdAt) > weekAgo).length;
    const closed = leads.filter((l) => l.stage === 'fechado').length;
    const done = leads.filter((l) => ['fechado', 'perdido'].includes(l.stage)).length;
    const conv = done ? Math.round((closed / done) * 100) : 0;
    const hot = leads.filter((l) => l.temperature === 'Quente' && !['fechado', 'perdido'].includes(l.stage)).length;
    const vgv = active.reduce((s, p) => s + (+p.price || 0), 0);
    $('#kpis').innerHTML = `
      <div class="kpi kpi--gold"><small>Leads quentes</small><b>${hot}</b><span>para atender agora</span></div>
      <div class="kpi"><small>Leads na semana</small><b>${week}</b><span>${leads.length} no total</span></div>
      <div class="kpi"><small>Imóveis ativos</small><b>${active.length}</b><span>VGV ${U.brlShort(vgv)}</span></div>
      <div class="kpi"><small>Conversão</small><b>${conv}%</b><span>${closed} negócio${closed === 1 ? '' : 's'} fechado${closed === 1 ? '' : 's'}</span></div>`;

    const max = Math.max(1, ...U.STAGES.map((s) => leads.filter((l) => l.stage === s.id).length));
    $('#funnel').innerHTML = U.STAGES.map((s) => {
      const n = leads.filter((l) => l.stage === s.id).length;
      return `<div class="frow"><span>${s.label}</span><div class="frow__bar"><i style="width:${(n / max) * 100}%;background:${s.color}"></i></div><b>${n}</b></div>`;
    }).join('');

    const bars = (map) => {
      const e = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (!e.length) return '<p class="empty">Sem dados ainda.</p>';
      const m = e[0][1];
      return e.map(([k, v]) => `<div class="bar"><div><span>${U.esc(k)}</span><span>${v}</span></div><i style="width:${(v / m) * 100}%"></i></div>`).join('');
    };
    const count = (fn) => leads.reduce((a, l) => { const k = fn(l); if (k) a[k] = (a[k] || 0) + 1; return a; }, {});
    $('#sources').innerHTML = bars(count((l) => l.source || 'Outro'));
    $('#regionsWanted').innerHTML = bars(count((l) => l.interest && l.interest.region));

    const today = new Date(); today.setHours(23, 59, 59);
    const fus = leads.filter((l) => l.followUp && !['fechado', 'perdido'].includes(l.stage)).sort((a, b) => new Date(a.followUp) - new Date(b.followUp)).slice(0, 6);
    $('#followups').innerHTML = fus.length ? fus.map((l) => {
      const d = new Date(l.followUp + 'T12:00:00'); const diff = Math.floor((d - new Date().setHours(12, 0, 0, 0)) / 864e5);
      const cls = diff < 0 ? 'late' : diff === 0 ? 'today' : '';
      return `<div class="fu" data-lead="${l.id}"><span class="fu__d ${cls}">${diff < 0 ? 'Atrasado' : diff === 0 ? 'Hoje' : U.date(d.toISOString()).slice(0, 6)}</span><div><b>${U.esc(l.name)}</b><br><small class="muted">${U.esc(STAGE[l.stage]?.label || '')}</small></div></div>`;
    }).join('') : '<p class="empty">Nenhum follow-up agendado. Abra um lead e defina a próxima ação.</p>';

    $('#recent').innerHTML = leads.length ? leadTable(leads.slice(0, 6)) : '<p class="empty">Os leads do site e da assistente IA aparecerão aqui automaticamente.</p>';
  }

  function leadTable(list) {
    return `<table><thead><tr><th>Lead</th><th>Interesse</th><th>Origem</th><th>Temperatura</th><th>Etapa</th><th>Quando</th><th></th></tr></thead><tbody>
      ${list.map((l) => {
        const i = l.interest || {};
        const s = STAGE[l.stage] || STAGE.novo;
        return `<tr data-lead="${l.id}">
          <td class="who"><b>${U.esc(l.name)}</b><small>${U.esc(U.phoneFmt(l.phone))}</small></td>
          <td>${U.esc([i.type, i.region].filter(Boolean).join(' · ') || '—')}<br><small class="muted">${i.maxPrice ? 'até ' + U.brlShort(i.maxPrice) : ''}</small></td>
          <td>${U.esc(l.source || '')}</td>
          <td><span class="temp temp--${l.temperature || 'Frio'}">${l.temperature || 'Frio'} · ${l.score || 0}</span></td>
          <td><span class="stage"><i style="background:${s.color}"></i>${s.label}</span></td>
          <td class="muted">${U.ago(l.createdAt)}</td>
          <td><a class="iconbtn" href="${U.wa(l.phone, `Olá, ${(l.name || '').split(' ')[0]}! Aqui é a Camila Severiano.`)}" target="_blank" rel="noopener" data-stop title="WhatsApp"><svg class="ic"><use href="#i-chat"/></svg></a></td></tr>`;
      }).join('')}</tbody></table>`;
  }

  /* ---------------- CRM ---------------- */
  function filteredLeads() {
    const q = U.norm(lv.q);
    return leads.filter((l) => {
      if (lv.temp && l.temperature !== lv.temp) return false;
      if (!q) return true;
      const i = l.interest || {};
      return U.norm([l.name, l.phone, l.email, l.source, i.region, i.type, l.propertyTitle].join(' ')).includes(q) || U.digits(l.phone).includes(U.digits(lv.q) || '#');
    });
  }
  function renderCRM() {
    const list = filteredLeads();
    $('#board').hidden = lv.view !== 'board';
    $('#leadList').hidden = lv.view !== 'list';
    if (lv.view === 'list') { $('#leadList').innerHTML = list.length ? leadTable(list) : '<p class="empty" style="padding:20px">Nenhum lead encontrado.</p>'; return; }
    const todayStr = new Date().toISOString().slice(0, 10);
    $('#board').innerHTML = U.STAGES.map((s) => {
      const items = list.filter((l) => (l.stage || 'novo') === s.id);
      return `<div class="col" data-stage="${s.id}"><div class="col__h"><i style="background:${s.color}"></i>${s.label}<em>${items.length}</em></div>
        <div class="col__list">${items.map((l) => {
          const i = l.interest || {};
          return `<article class="lcard" draggable="true" data-lead="${l.id}">
            <div class="lcard__top"><b>${U.esc(l.name)}</b><span class="temp temp--${l.temperature || 'Frio'}">${l.temperature || 'Frio'}</span></div>
            <p>${U.esc([i.type, i.region, i.maxPrice ? 'até ' + U.brlShort(i.maxPrice) : ''].filter(Boolean).join(' · ') || l.propertyTitle || 'Sem preferências')}</p>
            <div class="lcard__foot"><span class="lcard__src">${U.esc(l.source || '')}</span>${l.followUp ? `<span class="lcard__fu ${l.followUp < todayStr ? 'late' : ''}">↻ ${U.esc(l.followUp.split('-').reverse().slice(0, 2).join('/'))}</span>` : `<span>${U.ago(l.createdAt)}</span>`}</div>
          </article>`;
        }).join('')}</div></div>`;
    }).join('');
  }

  // Drag & drop no funil
  let dragId = null;
  $('#board').addEventListener('dragstart', (e) => { const c = e.target.closest('.lcard'); if (!c) return; dragId = c.dataset.lead; c.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; });
  $('#board').addEventListener('dragend', (e) => { const c = e.target.closest('.lcard'); if (c) c.classList.remove('is-drag'); $$('.col').forEach((c2) => c2.classList.remove('is-over')); });
  $('#board').addEventListener('dragover', (e) => { const col = e.target.closest('.col'); if (!col) return; e.preventDefault(); $$('.col').forEach((c) => c.classList.toggle('is-over', c === col)); });
  $('#board').addEventListener('drop', async (e) => {
    const col = e.target.closest('.col'); if (!col || !dragId) return;
    e.preventDefault();
    const l = leads.find((x) => x.id === dragId); dragId = null;
    if (l && l.stage !== col.dataset.stage) await moveStage(l, col.dataset.stage);
  });

  async function moveStage(l, stage) {
    const from = STAGE[l.stage]?.label; l.stage = stage;
    l.notes = [...(l.notes || []), { at: new Date().toISOString(), text: `Etapa: ${from} → ${STAGE[stage].label}`, auto: true }];
    await guard(() => store.saveLead(l), `Movido para “${STAGE[stage].label}”`);
    renderAll();
  }

  $('#leadSearch').addEventListener('input', (e) => { lv.q = e.target.value; renderCRM(); });
  $('#leadTemp').addEventListener('change', (e) => { lv.temp = e.target.value; renderCRM(); });
  $$('.seg button').forEach((b) => b.addEventListener('click', () => { lv.view = b.dataset.lv; $$('.seg button').forEach((x) => x.classList.toggle('is-on', x === b)); renderCRM(); }));

  $('#exportCsv').addEventListener('click', () => {
    const cols = ['Nome', 'Telefone', 'E-mail', 'Origem', 'Etapa', 'Temperatura', 'Pontuação', 'Tipo', 'Região', 'Orçamento', 'Quartos', 'Imóvel', 'Follow-up', 'Criado em', 'Mensagem'];
    const rows = filteredLeads().map((l) => { const i = l.interest || {}; return [l.name, U.phoneFmt(l.phone), l.email, l.source, STAGE[l.stage]?.label, l.temperature, l.score, i.type, i.region, i.maxPrice, i.bedrooms, l.propertyTitle, l.followUp, U.date(l.createdAt, true), l.message]; });
    const csv = '﻿' + [cols, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    download(csv, `leads-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  });

  /* Drawer do lead */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-stop]')) return;
    const t = e.target.closest('[data-lead]');
    if (t && !e.target.closest('#leadDrawer')) openLead(t.dataset.lead);
  });

  function openLead(id) {
    const l = id ? leads.find((x) => x.id === id) : null;
    const isNew = !l;
    const d = l || { name: '', phone: '', email: '', source: 'Manual', stage: 'novo', interest: {}, notes: [] };
    const i = d.interest || {};
    const first = (d.name || '').split(' ')[0];
    const prop = d.propertyId && props.find((p) => p.id === d.propertyId);
    const tpls = [
      ['Primeiro contato', `Olá, ${first}! Aqui é a Camila Severiano Recebi seu interesse${prop ? ` no ${prop.code} · ${prop.title}` : ''} e separei algumas opções para você. Posso te mostrar?`],
      ['Agendar visita', `Oi, ${first}! Que tal conhecermos o imóvel pessoalmente? Tenho horários amanhã pela manhã ou à tarde. Qual fica melhor para você?`],
      ['Retomar contato', `Oi, ${first}, tudo bem? Passando para saber se você ainda está buscando imóvel. Chegaram novidades que combinam com o que você me contou!`]
    ];
    $('#leadBox').innerHTML = `
      <div class="dw__head">
        <button class="iconbtn" data-close aria-label="Fechar"><svg class="ic"><use href="#i-x"/></svg></button>
        <p class="eyebrow" style="color:var(--gold-2)">${isNew ? 'Novo lead' : U.esc(d.source || '') + ' · ' + U.date(d.createdAt, true)}</p>
        <h2>${isNew ? 'Cadastrar lead' : U.esc(d.name)}</h2>
        ${isNew ? '' : `<div class="row"><span class="temp temp--${d.temperature || 'Frio'}">${d.temperature || 'Frio'} · ${d.score || 0} pts</span>
          <a class="btn btn--wa" href="${U.wa(d.phone, `Olá, ${first}! Aqui é a Camila Severiano.`)}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-chat"/></svg> ${U.esc(U.phoneFmt(d.phone))}</a></div>`}
      </div>
      <div class="dw__body">
        ${isNew ? '' : `<div class="dw__sec"><h4>Etapa do funil</h4><div class="stages">${U.STAGES.map((s) => `<button data-stage="${s.id}" class="${d.stage === s.id ? 'is-on' : ''}"><i style="background:${s.color}"></i>${s.label}</button>`).join('')}</div></div>`}
        <form class="form" id="leadForm">
          <div class="row2"><label>Nome<input name="name" value="${U.esc(d.name)}" required></label><label>WhatsApp<input name="phone" value="${U.esc(U.phoneFmt(d.phone))}" inputmode="tel" required></label></div>
          <div class="row2"><label>E-mail<input name="email" type="email" value="${U.esc(d.email || '')}"></label><label>Próximo follow-up<input name="followUp" type="date" value="${U.esc(d.followUp || '')}"></label></div>
          <div class="row2">
            <label>Tipo<select name="type"><option value="">—</option>${U.TYPES.map((t) => `<option ${t === i.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label>Região<select name="region"><option value="">—</option>${U.REGIONS.map((t) => `<option ${t === i.region ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          </div>
          <div class="row2"><label>Orçamento até (R$)<input name="maxPrice" inputmode="numeric" value="${i.maxPrice ? Number(i.maxPrice).toLocaleString('pt-BR') : ''}"></label><label>Quartos (mín.)<input name="bedrooms" type="number" min="0" value="${i.bedrooms || ''}"></label></div>
          <label>Imóvel de interesse<select name="propertyId"><option value="">—</option>${props.map((p) => `<option value="${p.id}" ${p.id === d.propertyId ? 'selected' : ''}>${U.esc(p.code + ' · ' + p.title)}</option>`).join('')}</select></label>
          ${d.message ? `<div class="note"><small>Mensagem do lead</small>${U.esc(d.message)}</div>` : ''}
          <div class="btnrow"><button class="btn btn--dark" type="submit">${isNew ? 'Cadastrar lead' : 'Salvar alterações'}</button>${isNew ? '' : '<button type="button" class="btn btn--danger" id="delLead"><svg class="ic"><use href="#i-trash"/></svg> Excluir</button>'}</div>
        </form>
        ${isNew ? '' : `
        <div class="dw__sec"><h4>Mensagens prontas (WhatsApp)</h4><div class="wa-tpl">${tpls.map(([t, m]) => `<a href="${U.wa(d.phone, m)}" target="_blank" rel="noopener"><b>${t}</b><br><span class="muted">${U.esc(m.slice(0, 80))}…</span></a>`).join('')}</div></div>
        <div class="dw__sec"><h4>Histórico e anotações</h4><div class="notes">
          <form id="noteForm"><input name="note" placeholder="Registrar ligação, visita, proposta…"><button class="btn btn--dark" type="submit">Anotar</button></form>
          ${[...(d.notes || [])].reverse().map((n) => `<div class="note"><small>${U.date(n.at, true)}</small>${U.esc(n.text)}</div>`).join('') || '<p class="empty">Sem anotações ainda.</p>'}
        </div></div>`}
      </div>`;
    const dw = $('#leadDrawer'); dw.hidden = false;

    $('#leadForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (!f.name.value.trim() || U.digits(f.phone.value).length < 10) return toast('Informe nome e WhatsApp com DDD.');
      const pid = f.propertyId.value; const pp = props.find((p) => p.id === pid);
      Object.assign(d, {
        name: f.name.value.trim(), phone: U.digits(f.phone.value), email: f.email.value.trim(), followUp: f.followUp.value || '',
        propertyId: pid || null, propertyTitle: pp ? `${pp.code} · ${pp.title}` : '',
        interest: { ...i, type: f.type.value, region: f.region.value, maxPrice: +U.digits(f.maxPrice.value) || null, bedrooms: +f.bedrooms.value || null }
      });
      Object.assign(d, U.scoreLead(d));
      const saved = await guard(() => store.saveLead(d), isNew ? 'Lead cadastrado' : 'Lead atualizado');
      await reload();
      if (isNew) openLead(saved.id);
    });
    if (isNew) return;
    $$('.stages button', dw).forEach((b) => b.addEventListener('click', async () => { await moveStage(d, b.dataset.stage); openLead(d.id); }));
    $('#noteForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const v = e.target.note.value.trim(); if (!v) return;
      d.notes = [...(d.notes || []), { at: new Date().toISOString(), text: v }];
      await guard(() => store.saveLead(d), 'Anotação salva'); renderAll(); openLead(d.id);
    });
    $('#delLead').addEventListener('click', async () => {
      if (!confirm(`Excluir o lead ${d.name}? Esta ação não pode ser desfeita.`)) return;
      await guard(() => store.deleteLead(d.id), 'Lead excluído'); dw.hidden = true; reload();
    });
  }
  $('#leadDrawer').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) $('#leadDrawer').hidden = true; });
  $$('[data-new-lead]').forEach((b) => b.addEventListener('click', () => openLead(null)));

  /* ---------------- IMÓVEIS ---------------- */
  let pq = '', pst = '';
  $('#propSearch').addEventListener('input', (e) => { pq = e.target.value; renderProps(); });
  $('#propStatus').addEventListener('change', (e) => { pst = e.target.value; renderProps(); });

  function renderProps() {
    const q = U.norm(pq);
    const list = props.filter((p) => {
      if (pst === 'draft' ? p.published !== false : pst && p.status !== pst) return false;
      return !q || U.norm([p.title, p.code, p.region, p.neighborhood, p.type].join(' ')).includes(q);
    });
    $('#plist').innerHTML = list.length ? list.map((p) => {
      const nLeads = leads.filter((l) => l.propertyId === p.id).length;
      const st = p.status === 'Vendido' ? 'tag--sold' : p.status === 'Reservado' ? 'tag--res' : '';
      return `<article class="prop">
        <div class="prop__img"><img src="${U.esc(U.cover(p))}" alt="" loading="lazy" data-type="${U.esc(p.type)}" data-seed="${U.esc(p.id)}">
          <div class="prop__tags">${p.published === false ? '<span class="tag tag--draft">Rascunho</span>' : ''}${p.featured ? '<span class="tag tag--gold">Destaque</span>' : ''}<span class="tag ${st}">${U.esc(p.status || 'Disponível')}</span></div></div>
        <div class="prop__b"><small>${U.esc(p.code || '')} · ${U.esc(p.region)}</small><h3>${U.esc(p.title)}</h3><span class="price">${U.brl(p.price)}</span><span class="leads">${nLeads} lead${nLeads === 1 ? '' : 's'} interessado${nLeads === 1 ? '' : 's'} · ${(p.photos || []).length} foto${(p.photos || []).length === 1 ? '' : 's'}</span></div>
        <div class="prop__act">
          <button class="iconbtn ${p.published !== false ? 'is-on' : ''}" data-act="pub" data-id="${p.id}" title="${p.published !== false ? 'Despublicar' : 'Publicar'}"><svg class="ic"><use href="#i-eye"/></svg></button>
          <button class="iconbtn ${p.featured ? 'is-on' : ''}" data-act="feat" data-id="${p.id}" title="Destaque"><svg class="ic"><use href="#i-star"/></svg></button>
          <button class="iconbtn" data-act="del" data-id="${p.id}" title="Excluir"><svg class="ic"><use href="#i-trash"/></svg></button>
          <button class="btn btn--ghost sp" data-act="edit" data-id="${p.id}"><svg class="ic"><use href="#i-edit"/></svg> Editar</button>
        </div></article>`;
    }).join('') : '<p class="empty">Nenhum imóvel aqui ainda. Clique em “Novo imóvel”.</p>';
    $$('#plist img').forEach((img) => img.addEventListener('error', () => { img.src = U.placeholder(img.dataset.type, img.dataset.seed); }, { once: true }));
  }

  $('#plist').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const p = props.find((x) => x.id === b.dataset.id); if (!p) return;
    if (b.dataset.act === 'edit') return openProp(p);
    if (b.dataset.act === 'del') {
      if (!confirm(`Excluir “${p.title}”?`)) return;
      await guard(() => store.deleteProperty(p.id), 'Imóvel excluído');
    }
    if (b.dataset.act === 'pub') { p.published = p.published === false; await guard(() => store.saveProperty(p), p.published ? 'Publicado no site' : 'Movido para rascunho'); }
    if (b.dataset.act === 'feat') { p.featured = !p.featured; await guard(() => store.saveProperty(p), p.featured ? 'Marcado como destaque' : 'Destaque removido'); }
    reload();
  });

  /* Formulário de imóvel */
  const pf = $('#propForm');
  pf.type.innerHTML = U.TYPES.map((t) => `<option>${t}</option>`).join('');
  $('#regionList').innerHTML = U.REGIONS.map((r) => `<option value="${r}">`).join('');
  let editing = null; let photos = [];

  function openProp(p) {
    editing = p ? { ...p } : null;
    photos = p ? [...(p.photos || [])] : [];
    pf.reset();
    $('#propFormTitle').textContent = p ? `Editar ${p.code || 'imóvel'}` : 'Novo imóvel';
    const v = p || { status: 'Disponível', purpose: 'Venda', published: true, type: 'Casa' };
    ['title', 'type', 'purpose', 'status', 'region', 'neighborhood', 'area', 'land', 'bedrooms', 'suites', 'parking', 'description'].forEach((k) => { if (v[k] !== undefined && v[k] !== null) pf[k].value = v[k]; });
    pf.price.value = v.price ? Number(v.price).toLocaleString('pt-BR') : '';
    pf.features.value = (v.features || []).join(', ');
    pf.published.checked = v.published !== false;
    pf.featured.checked = !!v.featured;
    $('#propErr').textContent = ''; $('#upStatus').textContent = '';
    renderPhotos();
    $('#propModal').hidden = false;
    pf.title.focus();
  }
  $$('[data-new-prop]').forEach((b) => b.addEventListener('click', () => { location.hash = '#imoveis'; openProp(null); }));
  $('#propModal').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) $('#propModal').hidden = true; });
  pf.price.addEventListener('input', () => { const d = U.digits(pf.price.value); pf.price.value = d ? Number(d).toLocaleString('pt-BR') : ''; });

  function renderPhotos() {
    $('#photoGrid').innerHTML = photos.map((src, i) => `<div class="ph" draggable="true" data-i="${i}"><img src="${U.esc(src)}" alt=""><div class="ph__a">
      ${i ? `<button type="button" data-cover="${i}" title="Usar como capa"><svg class="ic"><use href="#i-star"/></svg></button>` : ''}
      <button type="button" data-rm="${i}" title="Remover"><svg class="ic"><use href="#i-x"/></svg></button></div></div>`).join('');
  }
  $('#photoGrid').addEventListener('click', (e) => {
    const c = e.target.closest('[data-cover]'); const r = e.target.closest('[data-rm]');
    if (c) { const [x] = photos.splice(+c.dataset.cover, 1); photos.unshift(x); }
    if (r) photos.splice(+r.dataset.rm, 1);
    renderPhotos();
  });
  let phDrag = null;
  $('#photoGrid').addEventListener('dragstart', (e) => { const t = e.target.closest('.ph'); if (t) phDrag = +t.dataset.i; });
  $('#photoGrid').addEventListener('dragover', (e) => { if (phDrag !== null) e.preventDefault(); });
  $('#photoGrid').addEventListener('drop', (e) => {
    const t = e.target.closest('.ph'); if (!t || phDrag === null) return; e.preventDefault();
    const [x] = photos.splice(phDrag, 1); photos.splice(+t.dataset.i, 0, x); phDrag = null; renderPhotos();
  });

  async function addFiles(files) {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    const st = $('#upStatus');
    for (let k = 0; k < imgs.length; k++) {
      st.textContent = `Otimizando e enviando foto ${k + 1} de ${imgs.length}…`;
      try { photos.push(await store.uploadImage(imgs[k])); renderPhotos(); }
      catch (e) { toast(e.message); }
    }
    st.textContent = `${imgs.length} foto${imgs.length > 1 ? 's' : ''} adicionada${imgs.length > 1 ? 's' : ''}.`;
  }
  $('#photoInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  $('#addUrl').addEventListener('click', () => {
    const u = $('#photoUrl').value.trim();
    if (!/^https:\/\//.test(u)) return toast('Cole um link que comece com https://');
    photos.push(u); $('#photoUrl').value = ''; renderPhotos();
  });

  pf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#propErr');
    if (!pf.title.value.trim() || !pf.region.value.trim()) { err.textContent = 'Preencha ao menos título e região.'; return; }
    const num = (n) => (pf[n].value === '' ? null : +pf[n].value);
    const p = {
      ...(editing || {}),
      title: pf.title.value.trim(), type: pf.type.value, purpose: pf.purpose.value, status: pf.status.value,
      region: pf.region.value.trim(), neighborhood: pf.neighborhood.value.trim(),
      price: +U.digits(pf.price.value) || null, area: num('area'), land: num('land'),
      bedrooms: num('bedrooms') || 0, suites: num('suites') || 0, parking: num('parking') || 0,
      description: pf.description.value.trim(),
      features: pf.features.value.split(',').map((s) => s.trim()).filter(Boolean),
      photos, published: pf.published.checked, featured: pf.featured.checked, demo: false
    };
    try {
      await store.saveProperty(p);
      $('#propModal').hidden = true; toast(editing ? 'Imóvel atualizado' : 'Imóvel cadastrado'); reload();
    } catch (ex) { err.textContent = ex.message; }
  });

  /* ---------------- CONFIGURAÇÕES ---------------- */
  function fillSettings() {
    const f = $('#settingsForm');
    ['name', 'whatsapp', 'creci', 'instagram', 'email', 'assistantName', 'city'].forEach((k) => { f[k].value = settings[k] || ''; });
  }
  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const s = { ...settings };
    ['name', 'creci', 'email', 'assistantName', 'city'].forEach((k) => { s[k] = f[k].value.trim(); });
    s.whatsapp = U.waNumber(f.whatsapp.value);
    s.instagram = f.instagram.value.trim().replace(/^@/, '');
    if (s.whatsapp.length < 12) { $('#settingsMsg').textContent = ''; return toast('WhatsApp inválido: inclua o DDD.'); }
    await guard(() => store.saveSettings(s), 'Configurações salvas');
    settings = s; renderAll();
  });
  $('#passForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    if (f.p1.value !== f.p2.value) return toast('As senhas não conferem.');
    await guard(() => store.setPassword(f.p1.value), 'Senha atualizada'); f.reset();
  });

  function download(content, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('#backup').addEventListener('click', async () => download(JSON.stringify(await store.exportAll(), null, 2), `backup-camila-imoveis-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'));
  $('#restore').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!confirm('Restaurar este backup? Os dados atuais serão substituídos/mesclados.')) return;
      await guard(() => store.importAll(d), 'Backup restaurado'); reload();
    } catch (ex) { toast('Arquivo de backup inválido.'); }
    e.target.value = '';
  });
  $('#resetDemo').addEventListener('click', async () => {
    if (!confirm('Restaurar os imóveis de exemplo? Os imóveis atuais do modo local serão substituídos.')) return;
    await guard(() => store.resetDemo(), 'Imóveis de exemplo restaurados'); reload();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#propModal').hidden) $('#propModal').hidden = true;
    else if (!$('#leadDrawer').hidden) $('#leadDrawer').hidden = true;
  });

  boot();
})();

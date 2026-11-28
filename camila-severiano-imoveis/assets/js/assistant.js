/* Aurora — assistente de imóveis: entende linguagem natural, filtra, qualifica e leva ao WhatsApp. */
(function () {
  'use strict';
  const { U } = window.CS;
  const $ = (s) => document.querySelector(s);

  const el = { root: $('#ai'), fab: $('#aiFab'), panel: $('#aiPanel'), log: $('#aiLog'), quick: $('#aiQuick'), form: $('#aiForm'), text: $('#aiText'), close: $('#aiClose'), reset: $('#aiReset') };
  if (!el.root) return;

  let S; // estado da conversa
  const fresh = () => ({ step: 'start', prefs: {}, name: '', phone: '', shown: [], liked: null, started: false, done: false });
  S = fresh();

  const api = () => window.CS_SITE;
  const botName = () => (api() && api().settings().assistantName) || window.CS_CONFIG.assistantName || 'Aurora';
  const firstName = () => (S.name || '').split(' ')[0];

  /* ---------- Entendimento de linguagem ---------- */
  const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 };
  function parseMoney(t) {
    // "1,5 milhao", "2 mi", "800 mil", "800k", "r$ 650.000", "650000"
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*(milhao|milhoes|milh|mi\b|kk)/);
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e6);
    m = t.match(/(\d+(?:[.,]\d+)?)\s*(mil\b|k\b)/);
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 1e3);
    m = t.match(/r\$\s*([\d.]+(?:,\d+)?)/);
    if (m) { const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.')); if (v >= 10000) return v; }
    m = t.match(/\b(\d{5,8})\b/);
    if (m && !/\d{10,}/.test(t.replace(/\D/g, ''))) return +m[1];
    return null;
  }
  function parse(raw) {
    const t = U.norm(raw);
    const r = {};
    if (/riviera|golfe/.test(t)) r.region = 'Aquiraz Riviera';
    else if (/porto das dunas|beach park/.test(t)) r.region = 'Porto das Dunas';
    else if (/caponga|cascavel/.test(t)) r.region = 'Caponga';
    else if (/eusebio/.test(t)) r.region = 'Eusébio';
    else if (/aquiraz/.test(t)) r.region = 'Aquiraz';
    else if (/fortaleza|capital/.test(t)) r.region = 'Fortaleza';
    else if (/qualquer (lugar|regiao)|tanto faz|aberto|aberta|sem preferencia/.test(t)) r.region = 'Qualquer';

    if (/\blotes?\b|terreno/.test(t)) r.type = 'Lote';
    else if (/sitio|chacara|granja/.test(t)) r.type = 'Sítio';
    else if (/\bflat|studio|stúdio/.test(t)) r.type = 'Flat';
    else if (/cobertura/.test(t)) r.type = 'Cobertura';
    else if (/apartamento|\bapto?\b|\bap\b/.test(t)) r.type = 'Apartamento';
    else if (/casa de praia|casa na praia|beira.?mar/.test(t)) r.type = 'Casa de praia';
    else if (/casa.*condominio|condominio fechado/.test(t)) r.type = 'Casa em condomínio';
    else if (/\bcasas?\b|sobrado/.test(t)) r.type = 'Casa';
    else if (/comercial|loja|ponto|galpao/.test(t)) r.type = 'Comercial';

    if (/investi|renda|rentab|valoriza|alugar para|temporada/.test(t)) r.purpose = 'Investir';
    else if (/veraneio|fim de semana|fins de semana|ferias|descansar/.test(t)) r.purpose = 'Veraneio';
    else if (/primeiro imovel|1o imovel|primeira casa|sair do aluguel/.test(t)) r.purpose = 'Primeiro imóvel';
    else if (/morar|familia|mudar|moradia/.test(t)) r.purpose = 'Morar';

    let q = t.match(/(\d+)\s*(quartos?|qts?|dorm|suites?)/);
    if (!q) { const w = t.match(/\b(um|uma|dois|duas|tres|quatro|cinco|seis)\s*(quartos?|suites?|dorm)/); if (w) q = [0, NUM[w[1]]]; }
    if (q) r.bedrooms = Math.min(8, +q[1]);
    if (/sem quarto|tanto faz.*quarto|nao importa/.test(t) && S.step === 'beds') r.bedrooms = 0;

    const money = parseMoney(t);
    if (money) r.maxPrice = money;
    if (/sem limite|sem teto|alto padrao|luxo/.test(t) && S.step === 'budget') r.maxPrice = 99e6;

    const ph = raw.replace(/\D/g, '');
    if (ph.length >= 10 && ph.length <= 13 && !money) r.phone = ph;

    if (/financ|fgts|minha casa|caixa/.test(t)) r.intent = 'financiamento';
    else if (/visita|conhecer pessoalmente|agendar/.test(t)) r.intent = 'visita';
    else if (/permuta|troca/.test(t)) r.intent = 'permuta';
    else if (/document|escritura|itbi|cartorio/.test(t)) r.intent = 'documentacao';
    else if (/vender meu|vender minha|anunciar|avaliar meu|avaliacao/.test(t)) r.intent = 'vender';
    else if (/falar com|humano|corretora|camila|whats|ligar|atendente/.test(t)) r.intent = 'humano';
    if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey)\b/.test(t)) r.greet = true;
    if (/^(sim|isso|quero|pode|claro|bora|ok|vamos)\b/.test(t)) r.yes = true;
    if (/^(nao|agora nao|depois)\b/.test(t)) r.no = true;
    return r;
  }

  /* ---------- Busca inteligente com relaxamento ---------- */
  function search(p) {
    const all = (api() ? api().props() : []).filter((x) => x.status !== 'Vendido');
    const typeOk = (x, strict) => {
      if (!p.type) return true;
      if (x.type === p.type) return true;
      if (strict) return false;
      const fam = (s) => (/Casa/.test(s) ? 'casa' : /Apart|Flat|Cobertura/.test(s) ? 'ap' : s);
      return fam(x.type) === fam(p.type);
    };
    const regionOk = (x, strict) => {
      if (!p.region || p.region === 'Qualquer') return true;
      if (x.region === p.region) return true;
      return !strict && (p.region.startsWith('Aquiraz') && x.region.startsWith('Aquiraz') || (p.region === 'Aquiraz' && x.region === 'Porto das Dunas'));
    };
    const levels = [
      { price: 1.05, beds: true, strict: true, note: '' },
      { price: 1.15, beds: true, strict: false, note: 'Ampliei um pouquinho a busca para não deixar boas opções de fora.' },
      { price: 1.3, beds: false, strict: false, note: 'Não achei exatamente esse perfil, mas estas chegam bem perto:' },
      { price: 1.6, beds: false, strict: false, noRegion: true, note: 'Exatamente assim ainda não tenho publicado, mas veja estas alternativas:' }
    ];
    for (const lv of levels) {
      const res = all.filter((x) =>
        typeOk(x, lv.strict) && (lv.noRegion || regionOk(x, lv.strict)) &&
        (!p.maxPrice || (x.price || 0) <= p.maxPrice * lv.price) &&
        (!lv.beds || !p.bedrooms || (x.bedrooms || 0) >= p.bedrooms));
      if (res.length) {
        res.sort((a, b) => score(b) - score(a));
        return { list: res.slice(0, 3), note: lv.note };
      }
    }
    return { list: [], note: '' };
    function score(x) {
      let s = 0;
      if (x.type === p.type) s += 3;
      if (x.region === p.region) s += 3;
      if (p.bedrooms && x.bedrooms === p.bedrooms) s += 1;
      if (p.maxPrice && x.price) s += 2 - Math.abs(1 - x.price / p.maxPrice) * 2; // perto do teto = mais aproveitamento
      if (x.featured) s += 0.5;
      return s;
    }
  }

  /* ---------- UI ---------- */
  function add(html, who = 'bot') {
    const d = document.createElement('div');
    d.className = 'msg msg--' + who;
    d.innerHTML = html;
    el.log.appendChild(d);
    el.log.scrollTop = el.log.scrollHeight;
    return d;
  }
  function addNode(node) { el.log.appendChild(node); el.log.scrollTop = el.log.scrollHeight; }
  function quick(opts) {
    el.quick.innerHTML = '';
    (opts || []).forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = o.label || o;
      b.onclick = () => handle(o.value || o.label || o, o.label || o);
      el.quick.appendChild(b);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function say(...msgs) {
    for (const m of msgs) {
      const t = add('<span class="typing"><i></i><i></i><i></i></span>');
      t.style.padding = '0';
      await wait(Math.min(1100, 380 + String(m).length * 8));
      t.remove();
      add(m);
    }
  }

  function propCards(list) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-props';
    list.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'ai-prop'; b.type = 'button';
      b.innerHTML = `<img src="${U.esc(U.cover(p))}" alt=""><div><b>${U.esc(p.title)}</b><small>${U.esc(p.region)}${p.bedrooms ? ' · ' + p.bedrooms + ' qtos' : ''}${(p.area || p.land) ? ' · ' + (p.area || p.land) + 'm²' : ''}</small><span>${U.brl(p.price)}</span></div>`;
      const img = b.querySelector('img');
      img.addEventListener('error', () => { img.src = U.placeholder(p.type, p.id); }, { once: true });
      b.onclick = () => { S.liked = p; el.text.blur(); api() && api().openProperty(p.id); };
      wrap.appendChild(b);
    });
    addNode(wrap);
  }

  /* ---------- Fluxo ---------- */
  function nextStep() {
    const p = S.prefs;
    if (!p.purpose && !p.type) return 'goal';
    if (!p.type) return 'type';
    if (!p.region) return 'region';
    if (!p.maxPrice) return 'budget';
    if (p.bedrooms === undefined && !['Lote', 'Sítio', 'Comercial'].includes(p.type)) return 'beds';
    return 'results';
  }

  async function ask(step) {
    S.step = step;
    const P = {
      goal: ['Para começar: você está buscando um imóvel para quê?', ['Morar', 'Investir', 'Veraneio / casa de praia', 'Primeiro imóvel']],
      type: ['Perfeito! E qual tipo de imóvel combina com você?', ['Casa em condomínio', 'Apartamento', 'Casa de praia', 'Lote', 'Sítio', 'Flat']],
      region: ['Qual região você prefere?', ['Aquiraz Riviera', 'Eusébio', 'Porto das Dunas', 'Caponga', 'Aquiraz', 'Aberta a sugestões']],
      budget: ['Até quanto você pretende investir? Pode ser uma faixa aproximada.', ['Até 300 mil', 'Até 500 mil', 'Até 800 mil', 'Até 1,2 mi', 'Até 2 mi', 'Acima de 2 mi']],
      beds: ['Quantos quartos, no mínimo?', ['1 quarto', '2 quartos', '3 quartos', '4 quartos ou mais']]
    }[step];
    await say(P[0]);
    quick(P[1].map((l) => ({ label: l, value: l === 'Acima de 2 mi' ? 'sem limite' : l === 'Aberta a sugestões' ? 'qualquer regiao' : l === 'Veraneio / casa de praia' ? 'veraneio casa de praia' : l })));
  }

  async function showResults() {
    S.step = 'results';
    const p = S.prefs;
    const { list, note } = search(p);
    S.shown = list;
    const resumo = [p.type, p.region && p.region !== 'Qualquer' ? 'em ' + p.region : '', p.maxPrice && p.maxPrice < 99e6 ? 'até ' + U.brlShort(p.maxPrice) : '', p.bedrooms ? p.bedrooms + '+ quartos' : ''].filter(Boolean).join(', ');
    if (list.length) {
      await say(`Busquei por <b>${U.esc(resumo)}</b>. ${note || 'Separei as opções que mais combinam com você:'}`);
      propCards(list);
      await say('Toque em um imóvel para ver fotos e detalhes. A Camila também tem oportunidades que ainda não estão no site. Quer que ela te envie uma seleção personalizada pelo WhatsApp?');
    } else {
      await say(`Para <b>${U.esc(resumo)}</b> não tenho nada publicado agora, mas muitas oportunidades chegam para a Camila antes de serem anunciadas. Quer que ela busque para você?`);
    }
    quick([{ label: 'Sim, quero receber!', value: 'sim quero' }, { label: 'Refazer a busca', value: '__restart' }]);
  }

  async function askName() {
    S.step = 'name';
    await say('Ótimo! Como posso te chamar?');
    quick([]);
    el.text.placeholder = 'Seu nome';
  }
  async function askPhone() {
    S.step = 'phone';
    await say(`Prazer, ${U.esc(firstName())}! Qual seu WhatsApp com DDD? É por lá que a Camila vai te enviar as opções.`);
    el.text.placeholder = '(85) 9 9999-9999';
    el.text.setAttribute('inputmode', 'tel');
  }

  async function finish() {
    S.step = 'done'; S.done = true;
    el.text.placeholder = 'Escreva algo…'; el.text.removeAttribute('inputmode');
    const p = S.prefs;
    const liked = S.liked || null;
    const lead = {
      name: S.name, phone: S.phone, source: 'Assistente IA',
      interest: { purpose: p.purpose || '', type: p.type || '', region: p.region === 'Qualquer' ? '' : (p.region || ''), maxPrice: p.maxPrice && p.maxPrice < 99e6 ? p.maxPrice : null, bedrooms: p.bedrooms || null },
      propertyId: liked ? liked.id : null, propertyTitle: liked ? `${liked.code} · ${liked.title}` : '',
      message: S.shown.length ? 'Sugestões da assistente: ' + S.shown.map((x) => x.code).join(', ') : 'Sem imóvel publicado no perfil — buscar fora do site.' + (S.intents ? ' Assuntos: ' + S.intents.join(', ') : '')
    };
    if (api()) await api().saveLead(lead);
    const i = lead.interest;
    const busca = [i.type || 'imóvel', i.region ? 'em ' + i.region : '', i.maxPrice ? 'até ' + U.brlShort(i.maxPrice) : '', i.bedrooms ? i.bedrooms + '+ quartos' : '', i.purpose ? 'para ' + i.purpose.toLowerCase() : ''].filter(Boolean).join(', ');
    const txt = `Olá, Camila! Sou ${S.name}. Conversei com a ${botName()} no seu site e procuro: ${busca}.` +
      (liked ? `\nGostei do *${liked.code} · ${liked.title}* (${U.brl(liked.price)}).` : S.shown.length ? `\nOpções sugeridas: ${S.shown.map((x) => x.code).join(', ')}.` : '') +
      (S.intents && S.intents.length ? `\nTambém quero falar sobre: ${S.intents.join(', ')}.` : '') +
      '\nPode me ajudar?';
    const settings = api() ? api().settings() : window.CS_CONFIG;
    await say(`Prontinho, ${U.esc(firstName())}! Seu atendimento foi registrado com prioridade. Toque abaixo para chamar a Camila no WhatsApp: a mensagem já vai pronta.`);
    const a = document.createElement('a');
    a.className = 'btn btn--wa ai-wa'; a.target = '_blank'; a.rel = 'noopener';
    a.href = U.wa(settings.whatsapp, txt);
    a.innerHTML = '<svg class="ic"><use href="#i-chat"/></svg> Abrir WhatsApp da Camila';
    addNode(a);
    quick([{ label: 'Nova busca', value: '__restart' }]);
  }

  const FAQ = {
    financiamento: 'Sobre financiamento: a Camila te ajuda a simular com os principais bancos, usar o FGTS e entender a entrada ideal. Muitos imóveis aqui aceitam financiamento.',
    visita: 'Visitas são agendadas e acompanhadas pessoalmente pela Camila, e quem está fora do Ceará pode fazer por vídeo chamada.',
    permuta: 'Permuta é possível em várias negociações! A Camila avalia o seu imóvel e vê as opções que aceitam troca.',
    documentacao: 'A Camila acompanha toda a parte documental: certidões, ITBI, escritura e registro. Você não fica sozinho(a) em nenhuma etapa.',
    vender: 'Que ótimo! A Camila também capta imóveis para venda, com avaliação, fotos profissionais e divulgação. Vou só pegar seus dados para ela falar com você.'
  };

  async function handle(raw, label) {
    const text = String(raw || '').trim();
    if (!text) return;
    if (text === '__restart') { add(U.esc(label || 'Recomeçar'), 'me'); return restart(true); }
    add(U.esc(label || text), 'me');
    quick([]);
    const r = parse(text);

    if (S.step === 'name') {
      const nm = text.replace(/^(meu nome e|me chamo|sou o|sou a|sou)\s+/i, '').replace(/[^\p{L}\s'-]/gu, '').trim();
      if (nm.length < 2) return say('Pode me dizer seu nome, por favor?');
      S.name = nm.split(/\s+/).slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      return askPhone();
    }
    if (S.step === 'phone') {
      const d = U.digits(text);
      if (d.length < 10 || d.length > 13) return say('Hmm, esse número parece incompleto. Pode enviar com DDD? Ex.: 85 99999-9999');
      S.phone = d;
      return finish();
    }
    if (S.done) {
      if (r.type || r.region || r.maxPrice) { const keep = { name: S.name, phone: S.phone }; S = fresh(); Object.assign(S, keep, { started: true }); }
      else return say('Se quiser, posso fazer uma nova busca: é só me dizer o que procura. Ou toque no botão do WhatsApp acima para falar com a Camila.');
    }

    // intenções especiais
    if (r.intent) {
      S.intents = [...new Set([...(S.intents || []), r.intent])];
      if (FAQ[r.intent]) await say(FAQ[r.intent]);
      if (r.intent === 'humano' || r.intent === 'vender') return S.name ? (S.phone ? finish() : askPhone()) : askName();
    }

    // respostas às perguntas
    if (S.step === 'goal' && !r.purpose && !r.type) {
      if (/veraneio|praia/.test(U.norm(text))) r.purpose = 'Veraneio';
    }
    if (S.step === 'results') {
      if (r.yes || /receber|quero|sim/.test(U.norm(text))) return askName();
      if (r.no) return say('Sem problemas! Fique à vontade para explorar os imóveis. Se mudar de ideia, estou aqui.');
    }
    if (S.step === 'region' && !r.region && /sugest|qualquer|nao sei/.test(U.norm(text))) r.region = 'Qualquer';
    if (S.step === 'beds' && r.bedrooms === undefined) { const n = text.match(/\d/); if (n) r.bedrooms = +n[0]; }

    const before = JSON.stringify(S.prefs);
    ['purpose', 'type', 'region', 'maxPrice', 'bedrooms'].forEach((k) => { if (r[k] !== undefined) S.prefs[k] = r[k]; });
    if (S.prefs.purpose === 'Veraneio' && !S.prefs.type && /praia/.test(U.norm(text))) S.prefs.type = 'Casa de praia';
    const learned = JSON.stringify(S.prefs) !== before;

    if (r.greet && !learned && !r.intent) {
      await say(`Oi! Que bom ter você aqui.`);
      return ask(nextStep());
    }
    if (!learned && !r.intent && S.step !== 'start') {
      await say('Não entendi muito bem. Você pode tocar em uma das opções ou escrever, por exemplo: <b>“casa com 3 quartos no Eusébio até 900 mil”</b>.');
      return ask(nextStep());
    }
    if (learned && Object.keys(S.prefs).length >= 2 && S.step === 'start') {
      await say('Entendi! Deixa eu anotar aqui…');
    }
    const n = nextStep();
    if (n === 'results') return showResults();
    return ask(n);
  }

  async function restart(keepContact) {
    const keep = keepContact ? { name: S.name, phone: S.phone } : {};
    S = fresh(); Object.assign(S, keep); S.started = true;
    el.text.placeholder = 'Ex.: casa com 3 quartos no Eusébio até 900 mil';
    el.text.removeAttribute('inputmode');
    await ask('goal');
  }

  async function start() {
    if (S.started) return;
    S.started = true;
    $('#aiName').textContent = botName();
    await say(`Olá! Eu sou a <b>${U.esc(botName())}</b>, assistente da Camila Severiano.`,
      'Em menos de 1 minuto eu encontro imóveis que combinam com você. Pode escrever do seu jeito ou tocar nas opções.');
    S.step = 'start';
    quick([{ label: 'Quero morar', value: 'morar' }, { label: 'Quero investir', value: 'investir' }, { label: 'Casa de praia', value: 'veraneio casa de praia' }, { label: 'Lote para construir', value: 'lote' }, { label: 'Falar com a Camila', value: 'falar com a camila' }]);
  }

  /* Celular: chat em tela cheia que acompanha o teclado, página de trás travada e pausada */
  const isMobile = () => window.matchMedia('(max-width: 620px)').matches;
  const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
  const vv = window.visualViewport;
  let scrollY0 = 0;
  function fitViewport() {
    if (!isMobile() || el.panel.hidden) return;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    el.panel.style.height = h + 'px';
    el.panel.style.top = top + 'px';
    el.log.scrollTop = el.log.scrollHeight;
  }
  if (vv) { vv.addEventListener('resize', fitViewport); vv.addEventListener('scroll', fitViewport); }
  window.addEventListener('resize', fitViewport);
  el.text.addEventListener('focus', () => setTimeout(fitViewport, 60));

  function lockPage(on) {
    const html = document.documentElement;
    if (on && isMobile()) {
      scrollY0 = window.scrollY;
      html.classList.add('ai-lock');
      document.body.style.top = -scrollY0 + 'px';
    } else if (!on && html.classList.contains('ai-lock')) {
      html.classList.remove('ai-lock');
      document.body.style.top = '';
      window.scrollTo(0, scrollY0);
    }
  }

  function open() {
    el.root.classList.add('is-open'); el.panel.hidden = false; el.fab.setAttribute('aria-expanded', 'true');
    lockPage(true); fitViewport();
    start();
    if (!isTouch()) setTimeout(() => el.text.focus(), 250); // no celular, o teclado só abre quando a pessoa tocar no campo
  }
  function close() {
    el.text.blur();
    el.root.classList.remove('is-open'); el.panel.hidden = true; el.fab.setAttribute('aria-expanded', 'false');
    el.panel.style.height = ''; el.panel.style.top = '';
    lockPage(false);
    if (!isTouch()) el.fab.focus();
  }

  el.fab.addEventListener('click', open);
  el.close.addEventListener('click', close);
  el.reset.addEventListener('click', () => { el.log.innerHTML = ''; quick([]); restart(true); });
  el.form.addEventListener('submit', (e) => { e.preventDefault(); const v = el.text.value; el.text.value = ''; if (isTouch()) el.text.blur(); handle(v); });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-assistant]')) open(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.panel.hidden && document.getElementById('propModal').hidden) close(); });

  // Convite discreto depois de alguns segundos
  setTimeout(() => {
    if (S.started) return;
    const t = el.fab.querySelector('.ai__fab-txt');
    if (t) t.textContent = 'Posso te ajudar a encontrar?';
  }, 9000);

  window.CS_AI = { open, parse, search };
})();

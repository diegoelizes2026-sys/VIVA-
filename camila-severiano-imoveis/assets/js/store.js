/* Camada de dados: modo local (navegador) ou Supabase (nuvem). */
(function () {
  'use strict';
  const C = window.CS_CONFIG;

  /* ---------- utilidades compartilhadas ---------- */
  const U = {
    uid() {
      return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    },
    brl(v) {
      if (v === null || v === undefined || v === '' || isNaN(v)) return 'Sob consulta';
      return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    },
    brlShort(v) {
      if (!v) return '—';
      if (v >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
      if (v >= 1e3) return 'R$ ' + Math.round(v / 1e3) + ' mil';
      return 'R$ ' + v;
    },
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    norm(s) {
      return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    },
    digits(s) { return String(s || '').replace(/\D/g, ''); },
    phoneFmt(p) {
      let d = U.digits(p);
      if (d.startsWith('55') && d.length > 11) d = d.slice(2);
      if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return p || '';
    },
    waNumber(p) {
      let d = U.digits(p);
      if (d.length === 10 || d.length === 11) d = '55' + d;
      return d;
    },
    wa(number, text) {
      return `https://wa.me/${U.waNumber(number)}?text=${encodeURIComponent(text || '')}`;
    },
    date(iso, withTime) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', withTime ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' });
    },
    ago(iso) {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 60) return 'agora';
      if (s < 3600) return Math.floor(s / 60) + ' min';
      if (s < 86400) return Math.floor(s / 3600) + ' h';
      return Math.floor(s / 86400) + ' d';
    },
    /* Ilustração de reserva elegante quando não há foto ou a foto falha. */
    placeholder(type, seed, bare) {
      const palettes = [
        ['#F3E7D3', '#E2C9A2', '#0E4A48'], ['#EEE4D6', '#C9A66B', '#1F5F5B'],
        ['#F6EDE1', '#D9B98A', '#123B3A'], ['#ECE3D5', '#BF9A62', '#2A6662']
      ];
      const p = palettes[Math.abs(String(seed || type || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % palettes.length];
      const label = bare ? '' : U.esc((type || 'Imóvel').toUpperCase());
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${p[0]}'/><stop offset='1' stop-color='${p[1]}'/></linearGradient></defs>
<rect width='800' height='600' fill='url(#s)'/>
<circle cx='560' cy='330' r='70' fill='#fff' opacity='.55'/>
<rect y='360' width='800' height='240' fill='${p[2]}'/>
<path d='M0 395c60-18 120-18 180 0s120 18 180 0 120-18 180 0 120 18 180 0 60-18 80-12' stroke='#fff' stroke-opacity='.35' stroke-width='3' fill='none'/>
<path d='M120 360V250l110-70 110 70v110z' fill='#FAF6EF'/><path d='M100 262l130-86 130 86' stroke='#1B2422' stroke-width='6' fill='none'/>
<path d='M205 360v-62a25 25 0 0 1 50 0v62' fill='${p[1]}'/>
<text x='400' y='520' text-anchor='middle' font-family='Georgia,serif' font-size='26' letter-spacing='8' fill='#FAF6EF'>${label}</text></svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },
    cover(p) { return (p.photos && p.photos[0]) || U.placeholder(p.type, p.id); },
    STAGES: [
      { id: 'novo', label: 'Novo lead', color: '#C9A66B' },
      { id: 'contato', label: 'Em contato', color: '#5B8E8A' },
      { id: 'visita', label: 'Visita agendada', color: '#0E4A48' },
      { id: 'proposta', label: 'Proposta', color: '#8A6A3C' },
      { id: 'fechado', label: 'Fechado', color: '#2E7D4F' },
      { id: 'perdido', label: 'Perdido', color: '#9C9A94' }
    ],
    TYPES: ['Casa', 'Casa em condomínio', 'Casa de praia', 'Apartamento', 'Flat', 'Cobertura', 'Lote', 'Sítio', 'Comercial'],
    REGIONS: ['Aquiraz Riviera', 'Aquiraz', 'Eusébio', 'Porto das Dunas', 'Caponga', 'Fortaleza'],
    /* Pontuação do lead (0–100) e temperatura */
    scoreLead(l) {
      let s = 10;
      if (l.phone) s += 25;
      if (l.email) s += 5;
      const i = l.interest || {};
      if (i.maxPrice) s += 15;
      if (i.region) s += 10;
      if (i.type) s += 10;
      if (i.bedrooms) s += 5;
      if (l.propertyId) s += 15;
      if (/visita|hoje|urgente|a vista|à vista|financiamento aprovado/i.test(l.message || '')) s += 10;
      s = Math.min(100, s);
      return { score: s, temperature: s >= 70 ? 'Quente' : s >= 45 ? 'Morno' : 'Frio' };
    }
  };

  /* ---------- dados de exemplo (substitua pelo painel) ---------- */
  const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=75`;
  const now = Date.now();
  const SEED = [
    {
      code: 'CS-001', title: 'Casa assinada no Aquiraz Riviera', type: 'Casa em condomínio', purpose: 'Venda',
      region: 'Aquiraz Riviera', neighborhood: 'Condomínio Riviera — vista para o golfe', price: 2450000,
      bedrooms: 4, suites: 4, parking: 3, area: 320, land: 600,
      description: 'Arquitetura contemporânea com pé-direito duplo, integração total com a área gourmet e piscina de borda voltada para o campo de golfe. Acabamentos de alto padrão, energia solar e automação.',
      features: ['Vista para o golfe', 'Piscina de borda', 'Energia solar', 'Automação', 'Área gourmet', 'Segurança 24h'],
      photos: [IMG('photo-1613490493576-7fde63acd811'), IMG('photo-1600596542815-ffad4c1539a9'), IMG('photo-1600585154340-be6161a56a0c')],
      featured: true
    },
    {
      code: 'CS-002', title: 'Sítio no Aquiraz com piscina', type: 'Sítio', purpose: 'Venda',
      region: 'Aquiraz', neighborhood: 'Zona rural de Aquiraz', price: 650000,
      bedrooms: 3, suites: 1, parking: 6, area: 180, land: 5000,
      description: 'Refúgio verde com piscina, pomar formado, casa principal arejada e muito espaço para a família. Ideal para fins de semana ou para morar perto da praia com tranquilidade.',
      features: ['Piscina', 'Pomar formado', 'Poço profundo', 'Área de lazer', 'Terreno plano'],
      photos: [IMG('photo-1500382017468-9049fed747ef'), IMG('photo-1564013799919-ab600027ffc6')],
      featured: true
    },
    {
      code: 'CS-003', title: 'Casa de praia porteira fechada', type: 'Casa de praia', purpose: 'Venda',
      region: 'Caponga', neighborhood: 'Caponga — a poucos passos do mar', price: 550000,
      bedrooms: 3, suites: 2, parking: 2, area: 140, land: 360,
      description: 'Vendida porteira fechada: mobiliada e equipada, pronta para receber a família no próximo feriado. Varanda ampla, ventilação natural e clima de vila de pescadores.',
      features: ['Porteira fechada', 'Mobiliada', 'Varanda', 'Perto da praia', 'Churrasqueira'],
      photos: [IMG('photo-1499793983690-e29da59ef1c2'), IMG('photo-1507525428034-b723cf961d3e')],
      featured: true
    },
    {
      code: 'CS-004', title: 'Lote no Aquiraz Riviera', type: 'Lote', purpose: 'Venda',
      region: 'Aquiraz Riviera', neighborhood: 'Quadra com vista para o mar', price: 420000,
      bedrooms: 0, suites: 0, parking: 0, area: 0, land: 600,
      description: 'Lote plano em condomínio fechado com infraestrutura completa, clube, golfe e acesso à praia. Excelente para construir a casa dos sonhos ou investir com valorização.',
      features: ['Condomínio fechado', 'Clube', 'Campo de golfe', 'Infraestrutura pronta', 'Vista mar'],
      photos: [IMG('photo-1507525428034-b723cf961d3e')],
      featured: false
    },
    {
      code: 'CS-005', title: 'Apartamento em condomínio clube', type: 'Apartamento', purpose: 'Venda',
      region: 'Eusébio', neighborhood: 'Eusébio — perto da CE-040', price: 690000,
      bedrooms: 3, suites: 2, parking: 2, area: 98,
      description: 'Planta inteligente, varanda gourmet e lazer completo de clube: piscinas, academia, quadras e espaço kids. A 20 minutos de Fortaleza, com toda a qualidade de vida do Eusébio.',
      features: ['Varanda gourmet', 'Lazer de clube', 'Academia', 'Espaço kids', 'Portaria 24h'],
      photos: [IMG('photo-1512917774080-9991f1c4c750'), IMG('photo-1505691938895-1758d7feb511')],
      featured: false
    },
    {
      code: 'CS-006', title: 'Casa térrea em condomínio no Eusébio', type: 'Casa em condomínio', purpose: 'Venda',
      region: 'Eusébio', neighborhood: 'Condomínio horizontal', price: 1150000,
      bedrooms: 4, suites: 3, parking: 4, area: 240, land: 450,
      description: 'Casa térrea, iluminada e com jardim, em condomínio horizontal arborizado. Ideal para famílias que buscam segurança, espaço e escolas de qualidade por perto.',
      features: ['Térrea', 'Jardim', 'Piscina privativa', 'Condomínio arborizado', 'Escolas próximas'],
      photos: [IMG('photo-1580587771525-78b9dba3b914'), IMG('photo-1570129477492-45c003edd2be')],
      featured: true
    },
    {
      code: 'CS-007', title: 'Flat beira-mar no Porto das Dunas', type: 'Flat', purpose: 'Venda',
      region: 'Porto das Dunas', neighborhood: 'Porto das Dunas — Aquiraz', price: 480000,
      bedrooms: 1, suites: 1, parking: 1, area: 48,
      description: 'Flat com pool de locação e serviços de resort, a minutos dos parques aquáticos. Uma porta de entrada inteligente para quem quer renda com temporada.',
      features: ['Pool de locação', 'Serviços de resort', 'Vista mar', 'Mobiliado'],
      photos: [IMG('photo-1571896349842-33c89424de2d'), IMG('photo-1582719478250-c89cae4dc85b')],
      featured: false
    },
    {
      code: 'CS-008', title: 'Lote em condomínio no Eusébio', type: 'Lote', purpose: 'Venda',
      region: 'Eusébio', neighborhood: 'Loteamento fechado', price: 260000,
      bedrooms: 0, suites: 0, parking: 0, area: 0, land: 360,
      description: 'Seu primeiro passo para construir: lote regular em loteamento fechado com área verde e portaria. Condições facilitadas.',
      features: ['Condições facilitadas', 'Portaria', 'Área verde', 'Documentação ok'],
      photos: [IMG('photo-1500382017468-9049fed747ef')],
      featured: false
    }
  ].map((p, i) => ({
    id: 'seed-' + (i + 1), status: 'Disponível', published: true, demo: true,
    createdAt: new Date(now - i * 86400000 * 3).toISOString(), ...p
  }));

  const DEFAULT_SETTINGS = {
    name: C.name, whatsapp: C.whatsapp, creci: C.creci, instagram: C.instagram,
    email: C.email, city: C.city, assistantName: C.assistantName
  };

  /* ---------- compressão de imagem ---------- */
  function compressImage(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((b) => b ? resolve({ blob: b, dataUrl: c.toDataURL('image/jpeg', quality) }) : reject(new Error('Falha ao comprimir.')), 'image/jpeg', quality);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cs-imoveis::' + text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- modo local ---------- */
  const K = { props: 'cs_props_v1', leads: 'cs_leads_v1', settings: 'cs_settings_v1', pass: 'cs_pass_v1', sess: 'cs_session_v1' };
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { throw new Error('O armazenamento do navegador está cheio. Use menos fotos ou conecte o Supabase (veja o README).'); }
  };

  const Local = {
    mode: 'local',
    async listProperties() { return read(K.props, null) || SEED.map((p) => ({ ...p })); },
    async saveProperty(p) {
      const all = await this.listProperties();
      if (!p.id) { p.id = U.uid(); p.createdAt = new Date().toISOString(); }
      if (!p.code) p.code = 'CS-' + String(all.length + 1).padStart(3, '0');
      p.updatedAt = new Date().toISOString();
      const i = all.findIndex((x) => x.id === p.id);
      if (i >= 0) all[i] = p; else all.unshift(p);
      write(K.props, all);
      return p;
    },
    async deleteProperty(id) { write(K.props, (await this.listProperties()).filter((p) => p.id !== id)); },
    async listLeads() { return read(K.leads, []); },
    async createLead(l) { return this.saveLead(l); },
    async saveLead(l) {
      const all = await this.listLeads();
      if (!l.id) { l.id = U.uid(); l.createdAt = new Date().toISOString(); }
      l.updatedAt = new Date().toISOString();
      const i = all.findIndex((x) => x.id === l.id);
      if (i >= 0) all[i] = l; else all.unshift(l);
      write(K.leads, all);
      return l;
    },
    async deleteLead(id) { write(K.leads, (await this.listLeads()).filter((l) => l.id !== id)); },
    async getSettings() { return { ...DEFAULT_SETTINGS, ...read(K.settings, {}) }; },
    async saveSettings(s) { write(K.settings, s); return s; },
    async uploadImage(file) { return (await compressImage(file, 1280, 0.72)).dataUrl; },
    /* autenticação local (senha com hash no navegador) */
    needsSetup() { return !read(K.pass, null); },
    async isSignedIn() { return sessionStorage.getItem(K.sess) === '1' && !this.needsSetup(); },
    async setPassword(pw) { write(K.pass, await sha256(pw)); sessionStorage.setItem(K.sess, '1'); },
    async signIn(_email, pw) {
      if ((await sha256(pw)) !== read(K.pass, '')) throw new Error('Senha incorreta.');
      sessionStorage.setItem(K.sess, '1');
    },
    async signOut() { sessionStorage.removeItem(K.sess); },
    async exportAll() { return { properties: await this.listProperties(), leads: await this.listLeads(), settings: await this.getSettings() }; },
    async importAll(d) {
      if (d.properties) write(K.props, d.properties);
      if (d.leads) write(K.leads, d.leads);
      if (d.settings) write(K.settings, d.settings);
    },
    async resetDemo() { localStorage.removeItem(K.props); }
  };

  /* ---------- modo Supabase ---------- */
  function makeSupabase() {
    const sb = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);
    const bucket = C.supabase.bucket || 'imoveis';
    const rows = (r) => { if (r.error) throw new Error(r.error.message); return (r.data || []).map((x) => ({ ...x.data, id: x.id })); };
    const ok = (r) => { if (r.error) throw new Error(r.error.message); return r; };
    return {
      mode: 'supabase',
      async listProperties() { return rows(await sb.from('cs_properties').select('id,data').order('created_at', { ascending: false })); },
      async saveProperty(p) {
        if (!p.id) { p.id = U.uid(); p.createdAt = new Date().toISOString(); }
        if (!p.code) p.code = 'CS-' + Date.now().toString().slice(-5);
        p.updatedAt = new Date().toISOString();
        ok(await sb.from('cs_properties').upsert({ id: p.id, data: p, published: !!p.published }));
        return p;
      },
      async deleteProperty(id) { ok(await sb.from('cs_properties').delete().eq('id', id)); },
      async listLeads() { return rows(await sb.from('cs_leads').select('id,data').order('created_at', { ascending: false })); },
      async createLead(l) {
        l.id = U.uid(); l.createdAt = l.updatedAt = new Date().toISOString();
        ok(await sb.from('cs_leads').insert({ id: l.id, data: l }));
        return l;
      },
      async saveLead(l) {
        if (!l.id) { l.id = U.uid(); l.createdAt = new Date().toISOString(); }
        l.updatedAt = new Date().toISOString();
        ok(await sb.from('cs_leads').upsert({ id: l.id, data: l }));
        return l;
      },
      async deleteLead(id) { ok(await sb.from('cs_leads').delete().eq('id', id)); },
      async getSettings() {
        const r = await sb.from('cs_settings').select('data').eq('id', 'main').maybeSingle();
        return { ...DEFAULT_SETTINGS, ...((r.data && r.data.data) || {}) };
      },
      async saveSettings(s) { ok(await sb.from('cs_settings').upsert({ id: 'main', data: s })); return s; },
      async uploadImage(file) {
        const { blob } = await compressImage(file, 1800, 0.82);
        const path = `${new Date().getFullYear()}/${U.uid()}.jpg`;
        ok(await sb.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
        return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      },
      needsSetup() { return false; },
      async isSignedIn() { const { data } = await sb.auth.getSession(); return !!data.session; },
      async signIn(email, pw) { const r = await sb.auth.signInWithPassword({ email, password: pw }); if (r.error) throw new Error('E-mail ou senha inválidos.'); },
      async signOut() { await sb.auth.signOut(); },
      async exportAll() { return { properties: await this.listProperties(), leads: await this.listLeads(), settings: await this.getSettings() }; },
      async importAll(d) {
        for (const p of d.properties || []) await this.saveProperty(p);
        for (const l of d.leads || []) await this.saveLead(l);
        if (d.settings) await this.saveSettings(d.settings);
      },
      async resetDemo() { for (const p of SEED) await this.saveProperty({ ...p }); }
    };
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    });
  }

  const ready = (async () => {
    if (C.supabase && C.supabase.url && C.supabase.anonKey) {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
        return makeSupabase();
      } catch (e) { console.warn('Supabase indisponível, usando modo local.', e); }
    }
    return Local;
  })();

  window.CS = { U, ready, SEED };
})();

/*
 * CONFIGURAÇÃO DO SITE — Camila Severiano Imóveis
 * ------------------------------------------------
 * 1) Troque o WhatsApp e o CRECI pelos dados reais.
 * 2) (Recomendado para produção) Preencha supabase.url e supabase.anonKey
 *    para que imóveis e leads fiquem salvos na nuvem e apareçam para todos.
 *    Sem Supabase, o site funciona em "modo local": o painel salva apenas
 *    no navegador em que foi usado (ótimo para testar e apresentar).
 */
window.CS_CONFIG = {
  name: 'Camila Severiano',
  title: 'Camila Severiano Imóveis',
  tagline: 'Conecto sonhos a endereços reais.',
  whatsapp: '5585999999999',            // TROCAR: DDI + DDD + número, só dígitos
  creci: 'CRECI-CE 00000-F',            // TROCAR
  instagram: 'camilaseveriano_imoveis',
  email: 'contato@camilaseveriano.com.br', // TROCAR
  city: 'Eusébio, Aquiraz & Região — Ceará',
  assistantName: 'Aurora',

  supabase: {
    url: '',      // ex.: https://xxxx.supabase.co
    anonKey: '',  // chave pública (anon / publishable)
    bucket: 'imoveis'
  }
};

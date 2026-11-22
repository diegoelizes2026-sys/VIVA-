import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportEmailUrl, supportWhatsAppUrl } from "@/lib/support";

export default function ContaSuspensaPage() {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f7f5fc"}}>
    <section style={{maxWidth:440,textAlign:"center",background:"#fff",padding:32,borderRadius:24,boxShadow:"0 12px 40px #2c15551a"}}>
      <div style={{fontSize:42,marginBottom:12}}>🔒</div><h1 style={{color:"#4b247e",fontSize:26,fontWeight:800}}>Acesso suspenso</h1>
      <p style={{color:"#514b5d",lineHeight:1.6}}>Sua conta está suspensa. Fale com o suporte.</p>
      <div style={{display:"grid",gap:10,marginTop:16}}>
        <a href={supportWhatsAppUrl("Olá! Minha conta VIVA+ está suspensa e preciso de ajuda.")} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"12px 16px",borderRadius:14,background:"#6b35a8",color:"#fff",fontWeight:700}}>💬 WhatsApp {SUPPORT_WHATSAPP_DISPLAY}</a>
        <a href={supportEmailUrl("Conta suspensa - VIVA+")} style={{display:"block",padding:"12px 16px",borderRadius:14,border:"1px solid #d9cdee",color:"#4b247e",fontWeight:700}}>✉️ {SUPPORT_EMAIL}</a>
      </div>
      <a href="/login" style={{display:"inline-block",marginTop:16,color:"#6b35a8",fontWeight:700}}>Voltar ao login</a>
    </section>
  </main>;
}

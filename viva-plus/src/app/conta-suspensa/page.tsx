export default function ContaSuspensaPage() {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f7f5fc"}}>
    <section style={{maxWidth:440,textAlign:"center",background:"#fff",padding:32,borderRadius:24,boxShadow:"0 12px 40px #2c15551a"}}>
      <div style={{fontSize:42,marginBottom:12}}>🔒</div><h1 style={{color:"#4b247e",fontSize:26,fontWeight:800}}>Acesso suspenso</h1>
      <p style={{color:"#514b5d",lineHeight:1.6}}>Sua conta está suspensa. Fale com o suporte.</p>
      <a href="/login" style={{display:"inline-block",marginTop:16,color:"#6b35a8",fontWeight:700}}>Voltar ao login</a>
    </section>
  </main>;
}

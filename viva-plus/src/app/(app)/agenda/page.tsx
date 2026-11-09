import { CalendarDays, Clock3 } from "lucide-react";
import RecordForm from "@/components/record-form";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from("viva_events").select("*").order("start_at").limit(50);
  const events = data || [];
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = events.filter(e => new Date(e.start_at) >= today);
  return <div>
    <p className="page-eyebrow">ROTINA E COMPROMISSOS</p><h1 className="page-title">Sua agenda</h1><p className="page-description">Organize seus horários e tenha clareza sobre o que vem a seguir.</p>
    <div className="mt-7 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold tracking-tight">Próximos compromissos</h2><p className="mt-1 text-xs text-neutral-400">{upcoming.length} compromisso(s) a partir de hoje</p></div><span className="icon-surface h-10 w-10"><CalendarDays size={19}/></span></div>
        {events.length?<div className="mt-4 divide-y" style={{borderColor:"var(--viva-line)"}}>{events.map(e=><article key={e.id} className="flex gap-4 py-4"><div className="w-[58px] shrink-0 rounded-xl bg-[var(--viva-purple-soft)] px-2 py-3 text-center"><p className="text-[10px] font-bold uppercase text-[var(--viva-purple)]">{new Date(e.start_at).toLocaleDateString("pt-BR",{month:"short"})}</p><p className="mt-0.5 text-xl font-bold text-[var(--viva-purple)]">{new Date(e.start_at).getDate()}</p></div><div className="min-w-0 flex-1"><p className="font-bold text-neutral-900">{e.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500"><Clock3 size={13}/>{new Date(e.start_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}{e.end_at?" – "+new Date(e.end_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}</p>{e.description&&<p className="mt-2 text-sm leading-6 text-neutral-500">{e.description}</p>}</div></article>)}</div>:<div className="py-14 text-center"><CalendarDays size={28} className="mx-auto text-neutral-300"/><p className="mt-3 font-semibold text-neutral-800">Sua agenda começa aqui</p><p className="mt-1 text-sm text-neutral-500">Adicione seu primeiro compromisso ao lado.</p></div>}
      </section>
      <section className="card p-5 sm:p-6"><p className="page-eyebrow">NOVO REGISTRO</p><h2 className="mb-5 mt-1 text-lg font-bold">Adicionar compromisso</h2><RecordForm table="events" fields={[{name:"title",label:"Título",required:true},{name:"start_at",label:"Data e hora",type:"datetime-local",required:true},{name:"end_at",label:"Término",type:"datetime-local"},{name:"description",label:"Descrição"}]}/></section>
    </div>
  </div>;
}

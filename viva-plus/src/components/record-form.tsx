"use client";
import { useState, type FormEvent } from "react";

export default function RecordForm({table,fields,submitLabel="Salvar",onSaved}:{table:"viva_events"|"events"|"tasks"|"transactions";fields:{name:string;label:string;type?:string;required?:boolean;options?:string[]}[];submitLabel?:string;onSaved?:()=>void}) {
 const [values,setValues]=useState<Record<string,string>>({});const [msg,setMsg]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMsg("");
 try{const payload:Record<string,unknown>={};
 fields.forEach(f=>{const v=values[f.name];if(v!==undefined&&v!=="")payload[f.name]=f.type==="number"?Number(v):f.type==="boolean"?v==="true":v;});
 if(table==="transactions"&&payload.amount!==undefined)payload.amount=Math.abs(Number(payload.amount));
 if(table==="transactions"){const response=await fetch("/api/transactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"Não foi possível salvar.");window.dispatchEvent(new Event("viva:transactions-updated"));}else{const s=(await import("@/lib/supabase/client")).createClient();const {error}=await s.from(table).insert(payload);if(error)throw error;}
 setValues({});setMsg("Registro salvo com sucesso.");onSaved?.();
 }catch(e){setMsg(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setBusy(false);}}
 return <form onSubmit={submit} className="space-y-4">{fields.map(f=><label key={f.name} className="block text-sm font-semibold">{f.label}
 {f.type==="boolean"?<select className="field mt-2" required={f.required} value={values[f.name]??"true"} onChange={e=>setValues({...values,[f.name]:e.target.value})}><option value="true">Ativado</option><option value="false">Desativado</option></select>:f.options?<select className="field mt-2" required={f.required} value={values[f.name]||""} onChange={e=>setValues({...values,[f.name]:e.target.value})}><option value="">Selecione</option>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select>:<input className="field mt-2" required={f.required} type={f.type||"text"} value={values[f.name]||""} onChange={e=>setValues({...values,[f.name]:e.target.value})}/>}
 </label>)}<button disabled={busy} className="btn-primary">{busy?"Salvando...":submitLabel}</button>{msg&&<p role="status" className="text-sm" style={{color:"var(--purple)"}}>{msg}</p>}</form>
}

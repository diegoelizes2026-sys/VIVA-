"use client";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
export default function RecordForm({table,fields,submitLabel="Salvar",onSaved}:{table:"events"|"tasks"|"transactions";fields:{name:string;label:string;type?:string;required?:boolean;options?:string[]}[];submitLabel?:string;onSaved?:()=>void}) {
 const [values,setValues]=useState<Record<string,string>>({});const [msg,setMsg]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMsg("");
 try{const s=createClient();const payload:Record<string,unknown>={};
 fields.forEach(f=>{const v=values[f.name];if(v!==undefined&&v!=="")payload[f.name]=f.type==="number"?Number(v):v;});
 if(table==="transactions"&&payload.amount!==undefined)payload.amount=Math.abs(Number(payload.amount));
 const {error}=await s.from(table).insert(payload);if(error)throw error;
 setValues({});setMsg("Registro salvo com sucesso.");onSaved?.();
 }catch(e){setMsg(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setBusy(false);}}
 return <form onSubmit={submit} className="space-y-4">{fields.map(f=><label key={f.name} className="block text-sm font-semibold">{f.label}
 {f.options?<select className="field mt-2" required={f.required} value={values[f.name]||""} onChange={e=>setValues({...values,[f.name]:e.target.value})}><option value="">Selecione</option>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select>:<input className="field mt-2" required={f.required} type={f.type||"text"} value={values[f.name]||""} onChange={e=>setValues({...values,[f.name]:e.target.value})}/>}
 </label>)}<button disabled={busy} className="btn-primary">{busy?"Salvando...":submitLabel}</button>{msg&&<p role="status" className="text-sm" style={{color:"var(--purple)"}}>{msg}</p>}</form>
}

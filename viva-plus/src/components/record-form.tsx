"use client";
import { useState, type FormEvent } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Field={name:string;label:string;type?:string;required?:boolean;options?:string[]};
export default function RecordForm({table,fields,submitLabel="Salvar",onSaved}:{table:"events"|"tasks"|"transactions";fields:Field[];submitLabel?:string;onSaved?:()=>void}) {
 const [values,setValues]=useState<Record<string,string>>({});
 const [msg,setMsg]=useState("");const [success,setSuccess]=useState(false);const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setMsg("");setSuccess(false);
  try{
   const supabase=createClient();const payload:Record<string,unknown>={};
   fields.forEach(f=>{const value=values[f.name];if(value!==undefined&&value!=="")payload[f.name]=f.type==="number"?Number(value):value;});
   if(table==="transactions"&&payload.amount!==undefined)payload.amount=Math.abs(Number(payload.amount));
   const {error}=await supabase.from(table).insert(payload);if(error)throw error;
   setValues({});setMsg("Registro salvo com sucesso.");setSuccess(true);onSaved?.();
  }catch(error){setMsg(error instanceof Error?error.message:"Não foi possível salvar. Tente novamente.");}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="space-y-4">
  {fields.map(field=><label key={field.name} className="block text-[13px] font-semibold text-neutral-700">{field.label}{field.required&&<span className="ml-1 text-[var(--viva-purple)]">*</span>}
   {field.options?<select className="field mt-2" required={field.required} value={values[field.name]||""} onChange={e=>setValues({...values,[field.name]:e.target.value})}><option value="">Selecione</option>{field.options.map(option=><option key={option} value={option}>{option==="income"?"Receita":option==="expense"?"Despesa":option}</option>)}</select>:<input className="field mt-2" required={field.required} type={field.type||"text"} step={field.type==="number"?"0.01":undefined} value={values[field.name]||""} onChange={e=>setValues({...values,[field.name]:e.target.value})}/>}
  </label>)}
  <button disabled={busy} className="btn-primary w-full">{busy?"Salvando...":submitLabel}</button>
  {msg&&<p role="status" className={`flex items-start gap-2 rounded-xl p-3 text-xs leading-5 ${success?"bg-emerald-50 text-emerald-800":"bg-rose-50 text-rose-700"}`}>{success?<CheckCircle2 size={15} className="mt-0.5 shrink-0"/>:<AlertCircle size={15} className="mt-0.5 shrink-0"/>}{msg}</p>}
 </form>;
}

"use client";
import { useState } from "react";
import { Search, MapPin, Package, ExternalLink, Clock3, Store, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product={id:string;name:string;brand:string|null;model:string|null;image_url:string|null};
type Price={id:string;product_id:string;price:number;currency:string;observed_at:string;source_name:string;product_url:string|null;store:{name:string;city:string|null;state:string|null;address:string|null}|null};
const money=(n:number)=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=(s:string)=>new Date(s).toLocaleDateString("pt-BR");
export default function SearchExperience(){
 const [term,setTerm]=useState("");const [products,setProducts]=useState<Product[]>([]);const [prices,setPrices]=useState<Price[]>([]);
 const [sort,setSort]=useState("price");const [busy,setBusy]=useState(false);const [searched,setSearched]=useState(false);const [error,setError]=useState("");
 async function search(e?:React.FormEvent){
  e?.preventDefault();const q=term.trim();if(!q||busy)return;
  setBusy(true);setError("");setSearched(true);
  try{
   const supabase=createClient();const safe=q.replace(/[,%()]/g," ").replace(/\s+/g," ").trim();
   const {data,error:queryError}=await supabase.from("viva_products").select("id,name,brand,model,image_url").or("name.ilike.%"+safe+"%,brand.ilike.%"+safe+"%,model.ilike.%"+safe+"%").limit(24);
   if(queryError)throw queryError;
   const found=(data||[]) as Product[];setProducts(found);
   if(found.length){
    const {data:observations,error:priceError}=await supabase.from("viva_price_observations").select("id,product_id,price,currency,observed_at,source_name,product_url,store:viva_stores(name,city,state,address)").in("product_id",found.map(p=>p.id)).order("price",{ascending:true}).limit(120);
    if(priceError)throw priceError;setPrices((observations||[]) as unknown as Price[]);
   }else setPrices([]);
  }catch(err){setProducts([]);setPrices([]);setError(err instanceof Error?err.message:"Não foi possível pesquisar agora.");}
  finally{setBusy(false);}
 }
 const sorted=[...products].sort((a,b)=>{
  const ap=prices.filter(p=>p.product_id===a.id).map(p=>Number(p.price));
  const bp=prices.filter(p=>p.product_id===b.id).map(p=>Number(p.price));
  const av=ap.length?Math.min(...ap):Infinity,bv=bp.length?Math.min(...bp):Infinity;
  return sort==="price"?av-bv:a.name.localeCompare(b.name,"pt-BR");
 });
 return <div className="space-y-5">
  <form onSubmit={search} className="rounded-[20px] border bg-white p-3 shadow-sm sm:p-4" style={{borderColor:"var(--viva-line)"}}>
   <label className="mb-2 block px-1 text-xs font-bold text-neutral-500">PESQUISAR NO CATÁLOGO</label>
   <div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"/><input className="field pl-11" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Ex.: café, shampoo, fone de ouvido..." aria-label="Pesquisar produtos"/></div><button className="btn-primary sm:min-w-32" disabled={busy||!term.trim()}>{busy?"Pesquisando...":<><Search size={16}/> Buscar</>}</button></div>
   <p className="mt-3 px-1 text-[11px] text-neutral-400">A busca consulta o catálogo e as observações de preço cadastradas no VIVA+.</p>
  </form>
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
  {searched&& !busy && !error && products.length===0&&<div className="card px-5 py-12 text-center"><Package size={26} className="mx-auto text-neutral-300"/><h2 className="mt-4 font-bold text-neutral-800">Nenhum produto encontrado</h2><p className="mt-2 text-sm text-neutral-500">Tente outro nome. Só aparecem itens cadastrados no catálogo.</p></div>}
  {busy&&<div className="grid gap-3">{[1,2,3].map(n=><div key={n} className="card h-28 animate-pulse bg-neutral-100"/> )}</div>}
  {products.length>0&&!busy&&<section>
   <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-neutral-900">{products.length} {products.length===1?"produto encontrado":"produtos encontrados"}</p><p className="mt-1 text-xs text-neutral-400">Resultados do catálogo VIVA+</p></div><label className="flex items-center gap-2 text-xs font-semibold text-neutral-500"><SlidersHorizontal size={15}/><select className="rounded-xl border bg-white px-3 py-2 text-xs text-neutral-700 outline-none" style={{borderColor:"var(--viva-line)"}} value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Menor preço primeiro</option><option value="name">Nome A–Z</option></select></label></div>
   <div className="space-y-3">{sorted.map(product=>{
    const offers=prices.filter(p=>p.product_id===product.id).sort((a,b)=>Number(a.price)-Number(b.price));
    const best=offers[0];
    return <article key={product.id} className="card p-4 sm:p-5">
     <div className="flex gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#F7F5F9]">{product.image_url?<img src={product.image_url} alt="" className="h-full w-full object-contain"/>:<Package size={24} className="text-[#A49BAE]"/>}</div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="font-bold text-neutral-900">{product.name}</h2><p className="mt-1 text-xs text-neutral-500">{[product.brand,product.model].filter(Boolean).join(" · ")||"Produto cadastrado"}</p></div>{best?<div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">A partir de</p><p className="text-xl font-extrabold tracking-tight text-[var(--viva-purple)]">{money(Number(best.price))}</p></div>:<span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold text-neutral-500">Sem preço cadastrado</span>}</div></div>
     </div>
     {offers.length>0?<div className="mt-4 divide-y" style={{borderColor:"var(--viva-line)"}}>{offers.slice(0,4).map((offer,i)=><div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-semibold text-neutral-800"><Store size={14} className="shrink-0 text-neutral-400"/>{offer.store?.name||offer.source_name}</p><p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">{offer.store?.city&&<span className="inline-flex items-center gap-1"><MapPin size={11}/>{offer.store.city}{offer.store.state?", "+offer.store.state:""}</span>}<span className="inline-flex items-center gap-1"><Clock3 size={11}/>Consultado em {date(offer.observed_at)}</span></p></div><div className="flex items-center gap-3"><strong className="text-sm text-neutral-900">{money(Number(offer.price))}</strong>{offer.product_url&&<a href={offer.product_url} target="_blank" rel="noreferrer" aria-label="Abrir oferta na fonte" className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-[var(--viva-purple)]"><ExternalLink size={15}/></a>}</div>{i===0&&offers.length>1&&<span className="sr-only">Menor preço registrado</span>}</div>)}</div>:<p className="mt-4 border-t pt-3 text-xs text-neutral-400" style={{borderColor:"var(--viva-line)"}}>Ainda não há observações de preço para este produto.</p>}
    </article>;
   })}</div>
  </section>}
  <div className="rounded-2xl bg-[#F0EDF4] p-4 text-xs leading-5 text-neutral-500"><strong className="text-neutral-700">Sobre os resultados:</strong> preços refletem observações registradas e podem estar desatualizados. O catálogo atual não contém avaliações, disponibilidade em tempo real ou distância; esses dados não são exibidos como se estivessem confirmados.</div>
 </div>;
}

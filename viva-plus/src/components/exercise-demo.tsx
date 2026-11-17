"use client";

import {useEffect,useMemo,useState} from "react";

type Gender="female"|"male";
type Variant="mobile"|"desktop";
type Exercise={id:string;name:string;aliases:string[];muscles:string;steps:string[];errors:string[];cardio?:boolean;time?:string;intensity?:string};
const EXERCISES:Exercise[]=[
 {id:"caminhada",name:"Caminhada",aliases:["caminhada","andar","esteira","walking"],muscles:"Pernas, glúteos e sistema cardiovascular",steps:["Mantenha o tronco ereto e olhe para a frente.","Pise primeiro com o calcanhar e role o pé até a ponta.","Balance os braços naturalmente, sem tensionar os ombros.","Mantenha um ritmo em que consiga falar frases curtas."],errors:["Dar passos excessivamente longos.","Olhar para o chão o tempo todo.","Começar em ritmo forte demais."],cardio:true,time:"30 min",intensity:"Moderada"},
 {id:"corrida",name:"Corrida",aliases:["corrida","correr","trote","running"],muscles:"Panturrilhas, quadríceps, posteriores, glúteos e core",steps:["Incline levemente o corpo a partir dos tornozelos.","Olhe para a frente e mantenha os ombros relaxados.","Pouse os pés próximos ao centro de gravidade.","Respire de forma ritmada e ajuste a velocidade ao seu nível."],errors:["Aumentar distância ou velocidade de uma vez.","Tensionar mãos e ombros.","Ignorar dor ou falta de ar fora do normal."],cardio:true,time:"20–30 min",intensity:"Leve a moderada"},
 {id:"agachamento",name:"Agachamento",aliases:["agachamento","agachamento livre","squat","agacho"],muscles:"Quadríceps, glúteos, posteriores e core",steps:["Afaste os pés aproximadamente na largura dos ombros.","Leve o quadril para trás e flexione os joelhos.","Mantenha o peito aberto e os pés totalmente apoiados.","Desça até onde preserve conforto e controle.","Empurre o chão para voltar, sem travar os joelhos."],errors:["Deixar os joelhos caírem para dentro.","Tirar os calcanhares do chão.","Arredondar excessivamente as costas."]},
 {id:"flexao",name:"Flexão",aliases:["flexão","flexao de braço","flexão de braço","push up","push-up"],muscles:"Peitoral, tríceps, ombros e core",steps:["Apoie as mãos um pouco além da largura dos ombros.","Estenda as pernas e alinhe cabeça, tronco e quadril.","Flexione os cotovelos levando o peito em direção ao chão.","Empurre o solo até estender os braços com controle."],errors:["Deixar o quadril cair ou subir demais.","Abrir os cotovelos excessivamente.","Fazer o movimento rápido e sem controle."]},
 {id:"prancha",name:"Prancha",aliases:["prancha","prancha abdominal","plank"],muscles:"Abdômen, oblíquos, lombar e estabilizadores dos ombros",steps:["Apoie antebraços e pontas dos pés no chão.","Alinhe cotovelos abaixo dos ombros.","Mantenha cabeça, tronco e quadril em linha reta.","Contraia o abdômen e respire sem prender o ar."],errors:["Deixar o quadril afundar.","Elevar demais o quadril.","Prender a respiração."]},
 {id:"supino-reto",name:"Supino reto",aliases:["supino reto","supino","bench press"],muscles:"Peitoral, tríceps e deltoide anterior",steps:["Deite no banco com os pés firmes no chão.","Segure a barra um pouco além da largura dos ombros.","Desça a barra com controle em direção ao meio do peito.","Empurre para cima sem perder a estabilidade dos ombros."],errors:["Quicar a barra no peito.","Retirar os pés do chão.","Descer sem controle ou com dor no ombro."]},
 {id:"remada",name:"Remada",aliases:["remada","remada curvada","remada baixa","row"],muscles:"Costas, romboides, latíssimo e bíceps",steps:["Estabilize o tronco e mantenha a coluna neutra.","Inicie o movimento levando os cotovelos para trás.","Aproxime as escápulas sem elevar os ombros.","Retorne devagar até estender os braços."],errors:["Arredondar a lombar.","Usar impulso do tronco.","Encolher os ombros."]},
 {id:"afundo",name:"Afundo",aliases:["afundo","passada","lunge"],muscles:"Quadríceps, glúteos e posteriores",steps:["Fique em pé com os pés afastados na largura do quadril.","Dê um passo à frente mantendo o tronco estável.","Flexione os dois joelhos de forma confortável.","Empurre o chão com o pé da frente e retorne."],errors:["Perder o equilíbrio por passos muito curtos.","Deixar o joelho da frente colapsar para dentro.","Inclinar excessivamente o tronco."]},
 {id:"abdominal",name:"Abdominal",aliases:["abdominal","crunch","abdominal curto"],muscles:"Reto abdominal e estabilizadores do tronco",steps:["Deite de costas com os joelhos flexionados.","Apoie as mãos levemente ao lado da cabeça ou no peito.","Eleve os ombros contraindo o abdômen.","Desça devagar sem puxar o pescoço."],errors:["Puxar a cabeça com as mãos.","Usar balanço para subir.","Prender a respiração."]},
 {id:"alongamento",name:"Alongamento",aliases:["alongamento","alongar","stretch"],muscles:"Grupos musculares envolvidos no movimento escolhido",steps:["Adote uma posição estável e confortável.","Entre no alongamento lentamente, sem impulso.","Mantenha tensão leve, nunca dor.","Respire normalmente e solte a posição com calma."],errors:["Forçar amplitude com dor.","Fazer movimentos bruscos.","Prender a respiração."]}
];
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").replace(/\b(exercicios|exercicio)\b/g," ").replace(/\s+/g," ").trim().replace(/s\b/,"");
const resolve=(name:string):Exercise=>{
 const value=normalize(name);
 return EXERCISES.find(item=>[item.name,...item.aliases].some(alias=>normalize(alias)===value||value.includes(normalize(alias))))||{
  id:value.replace(/\s+/g,"-").slice(0,48)||"exercicio",name:name.trim(),aliases:[],muscles:"Músculos envolvidos conforme a variação do exercício",steps:["Prepare uma posição estável e confortável.","Execute o movimento lentamente, mantendo o controle.","Mantenha a respiração contínua e a postura alinhada.","Interrompa se sentir dor e peça orientação profissional."],errors:["Usar impulso ou perder o controle do movimento.","Compensar com a coluna ou articulações.","Continuar apesar de dor."]
 };
};
function parsePlan(plan:string){
 const rows=plan.split(/\n+/).map(line=>line.replace(/^\s*(?:[-*•▪]+|\d+[.)])\s*/,"").trim()).filter(Boolean);
 const found:{exercise:Exercise;dose:string}[]=[];
 for(const row of rows){
  const match=row.match(/^(.{3,90}?)(?:\s*[-–—:|,]\s*|\s+)(\d+\s*(?:x|×)\s*\d+[^.]*)?$/i);
  const candidate=(match?.[1]||row).replace(/\([^)]*\)/g,"").trim();
  if(/^(dia |segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|aquecimento|descanso|observa|dica|treino|semana)/i.test(candidate))continue;
  if(candidate.length<3||candidate.length>90)continue;
  const exercise=resolve(candidate);
  const known=EXERCISES.some(item=>item.id===exercise.id);
  if(!known&&!/(agach|supin|remad|flex|pranch|corrid|caminh|afund|abdomin|along|puxad|desenvolv|leg |rosca|panturr|burpee|bike|biciclet)/i.test(candidate))continue;
  if(!found.some(item=>item.exercise.id===exercise.id))found.push({exercise,dose:match?.[2]||""});
 }
 return found.slice(0,18);
}
export default function ExerciseDemo({plan,gender,variant}:{plan:string;gender:Gender;variant:Variant}){
 const [selected,setSelected]=useState<{exercise:Exercise;dose:string}|null>(null);
 const [image,setImage]=useState("");
 const [loading,setLoading]=useState(false);
 const [imageNotice,setImageNotice]=useState("");
 const [query,setQuery]=useState("");
 const [localAvailable,setLocalAvailable]=useState(false);
 const [localChecked,setLocalChecked]=useState(false);
 const [fallbackError,setFallbackError]=useState(false);
 const exercises=useMemo(()=>parsePlan(plan),[plan]);
 const dark=variant==="desktop";
 const choose=async(item:{exercise:Exercise;dose:string})=>{
  setSelected(item);setImage("");setImageNotice("");setFallbackError(false);setLocalAvailable(false);setLocalChecked(false);
  const localUrl="/exercicios/"+item.exercise.id+".webp";
  try{
   const head=await fetch(localUrl,{method:"HEAD",cache:"force-cache"});
   if(head.ok){setImage(localUrl);setLocalAvailable(true);setLocalChecked(true);return;}
  }catch{}
  setLocalChecked(true);
  try{
   const cached=localStorage.getItem("viva-exercise-image:"+item.exercise.id);
   if(cached){setImage(cached);setImageNotice("Ilustração salva neste dispositivo.");return;}
  }catch{}
  setLoading(true);
  try{
   const response=await fetch("/api/personal/exercise-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({exercise:item.exercise.name+" ("+item.exercise.id+")",gender,prompt:"Ilustração limpa de um personal trainer demonstrando "+item.exercise.name+" com postura correta, vista lateral, fundo roxo escuro neutro, estilo VIVA+, sem texto."})});
   const json=await response.json();
   if(!response.ok||!json.image)throw new Error(json.error||"Imagem indisponível");
   setImage(json.image);setImageNotice("Ilustração gerada por IA, confirme a técnica com um profissional");
   try{localStorage.setItem("viva-exercise-image:"+item.exercise.id,json.image);}catch{}
  }catch{setFallbackError(true);}
  finally{setLoading(false);}
 };
 const quick=["Caminhada","Corrida","Agachamento","Flexão","Prancha","Supino reto","Remada","Afundo","Abdominal","Alongamento"];
 const available=EXERCISES.filter(item=>item.name.toLowerCase().includes(query.toLowerCase()));
 return <section className={dark?"rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-3 text-white":"mt-4 rounded-[16px] border border-purple-100 bg-white p-3 text-gray-800"} style={{maxWidth:"100%",minWidth:0}}>
  <p className={dark?"mb-2 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200":"text-[13px] font-extrabold text-purple-900"}>Demonstração visual do exercício</p>
  {!selected?<><p className={dark?"mb-2 text-[11px] leading-4 text-white/65":"mt-1 text-[12px] text-gray-500"}>Escolha um exercício para ver a execução. Não precisa digitar.</p>
   {exercises.length>0&&<div className="mb-3 space-y-2"><p className={dark?"text-[11px] font-bold text-fuchsia-200":"text-[12px] font-bold text-purple-800"}>Exercícios do seu treino</p>{exercises.map(item=><div key={item.exercise.id} className={dark?"flex items-center justify-between gap-2 rounded-xl bg-black/20 p-2":"flex items-center justify-between gap-2 rounded-xl bg-purple-50 p-2"}><div className="min-w-0"><p className="truncate text-[13px] font-bold">{item.exercise.name}</p>{item.dose&&<p className={dark?"text-[11px] text-white/60":"text-[11px] text-gray-500"}>{item.dose}</p>}</div><button type="button" onClick={()=>void choose(item)} className="min-h-11 shrink-0 rounded-lg bg-[#7C3AED] px-3 text-[12px] font-bold text-white">Ver como fazer</button></div>)}</div>}
   <p className={dark?"mb-2 text-[11px] font-bold text-fuchsia-200":"mb-2 text-[12px] font-bold text-purple-800"}>Atalhos rápidos</p><div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">{quick.map(label=><button key={label} type="button" onClick={()=>void choose({exercise:resolve(label),dose:""})} className="min-h-11 shrink-0 rounded-full border border-purple-300/40 bg-purple-500/10 px-3 text-[12px] font-semibold text-purple-700">{label}</button>)}</div>
   <details className="mt-2"><summary className={dark?"min-h-11 cursor-pointer py-2 text-[11px] font-semibold text-fuchsia-200":"min-h-11 cursor-pointer py-2 text-[12px] font-semibold text-purple-700"}>Buscar outro exercício</summary><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar na biblioteca" className="mt-2 min-h-11 w-full rounded-xl border border-purple-200 bg-white px-3 text-[13px] text-gray-800"/><div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{available.map(item=><button key={item.id} type="button" onClick={()=>void choose({exercise:item,dose:""})} className="min-h-11 rounded-full bg-purple-50 px-3 text-[12px] font-semibold text-purple-800">{item.name}</button>)}</div></details>
  </>:<div className="space-y-3"><button type="button" onClick={()=>{setSelected(null);setImage("");}} className="min-h-11 rounded-lg border border-purple-300/50 px-4 text-[12px] font-bold text-purple-700">← Voltar</button><div><h3 className={dark?"text-base font-extrabold text-white":"text-base font-extrabold text-purple-950"}>{selected.exercise.name}</h3>{selected.dose&&<p className={dark?"text-xs text-white/65":"text-xs text-gray-500"}>Séries/repetições: {selected.dose}</p>}</div>
   <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-purple-200/40 bg-[#21103D]">{image?<img src={image} alt={"Ilustração de "+selected.exercise.name} className="h-full w-full object-contain" onError={()=>{setImage("");setFallbackError(true);}}/>:loading?<div className="flex flex-col items-center gap-3 text-center text-white"><span className="h-10 w-10 animate-spin rounded-full border-4 border-fuchsia-200/30 border-t-fuchsia-300"/><span className="text-xs font-semibold">Preparando sua demonstração...</span></div>:<div className="px-4 text-center text-white/75"><span className="text-3xl">🏋️</span><p className="mt-2 text-xs">Demonstração em texto disponível</p></div>}</div>
   {imageNotice&&<p className="text-[10px] leading-4 text-amber-600">{imageNotice}</p>}
   <div><p className={dark?"text-[11px] font-bold text-fuchsia-200":"text-[12px] font-bold text-purple-800"}>Músculos trabalhados</p><p className={dark?"mt-1 text-xs text-white/80":"mt-1 text-xs text-gray-600"}>{selected.exercise.muscles}</p></div>
   {selected.exercise.cardio&&<p className={dark?"rounded-lg bg-white/5 p-2 text-xs text-white/80":"rounded-lg bg-purple-50 p-2 text-xs text-purple-800"}>Sugestão: {selected.exercise.time} • Intensidade {selected.exercise.intensity}</p>}
   <div><p className={dark?"text-[11px] font-bold text-fuchsia-200":"text-[12px] font-bold text-purple-800"}>Como executar</p><ol className={dark?"mt-1 list-decimal space-y-1 pl-5 text-xs leading-5 text-white/85":"mt-1 list-decimal space-y-1 pl-5 text-xs leading-5 text-gray-700"}>{selected.exercise.steps.map(step=><li key={step}>{step}</li>)}</ol></div>
   <div><p className={dark?"text-[11px] font-bold text-fuchsia-200":"text-[12px] font-bold text-purple-800"}>Erros comuns</p><ul className={dark?"mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-white/75":"mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-gray-600"}>{selected.exercise.errors.map(error=><li key={error}>{error}</li>)}</ul></div>
   <p className={dark?"text-[10px] text-white/50":"text-[10px] text-gray-500"}>Esta demonstração não consome créditos de conversa VIVA+.</p>{fallbackError&&<p className="text-[10px] text-amber-600">Imagem indisponível no momento; siga os passos em texto e confirme a técnica com um profissional.</p>}
  </div>}
 </section>;
}

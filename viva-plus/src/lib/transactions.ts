import type { SupabaseClient } from "@supabase/supabase-js";
const categories=["Alimentação","Moradia","Transporte","Saúde","Educação","Lazer","Compras","Contas","Renda","Outros"];
const payments=["Pix","Dinheiro","Débito","Crédito","Transferência","Outro"];
export function normalizeCategory(value:unknown){const v=String(value||"").toLowerCase();if(/alimenta|mercado|supermercado|restaurante/.test(v))return "Alimentação";if(/aluguel|moradia|casa/.test(v))return "Moradia";if(/luz|água|internet|telefone|conta/.test(v))return "Contas";if(/salário|salario|renda/.test(v))return "Renda";if(/transporte|combustível|uber/.test(v))return "Transporte";return categories.find(x=>x.toLowerCase()===v)||"Outros"}
export function normalizePayment(value:unknown){const v=String(value||"").toLowerCase();if(/pix/.test(v))return "Pix";if(/dinheiro|espécie|especie/.test(v))return "Dinheiro";if(/débito|debito/.test(v))return "Débito";if(/crédito|credito|cartão/.test(v))return "Crédito";if(/transfer/.test(v))return "Transferência";return payments.includes(String(value))?String(value):"Outro"}
export async function createTransaction(s:SupabaseClient,userId:string,input:{kind:unknown;amount:unknown;description:unknown;occurred_on:unknown;category?:unknown;payment_method?:unknown;source?:unknown}){
 const kind=input.kind;if(kind!=="income"&&kind!=="expense")throw new Error("Tipo de lançamento inválido.");
 const amount=Number(input.amount);if(!Number.isFinite(amount)||amount<=0||amount>100000000)throw new Error("Informe um valor maior que zero e dentro do limite permitido.");
 const description=String(input.description||"").trim();if(!description||description.length>240)throw new Error("Informe uma descrição válida.");
 const date=String(input.occurred_on||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T12:00:00Z")))throw new Error("Data inválida.");
 const {data,error}=await s.from("viva_transactions").insert({user_id:userId,kind,amount,description,occurred_on:date,category:normalizeCategory(input.category),payment_method:normalizePayment(input.payment_method),source:input.source==="viva"?"viva":"manual"}).select("id,kind,amount,description,occurred_on,category,payment_method,source").single();
 if(error)throw error;return data;
}

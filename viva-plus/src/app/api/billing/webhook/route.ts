import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { notifyWhatsappPlanActive } from "@/lib/whatsapp";
import { notifySale } from "@/lib/sale-alert";
export const runtime = "nodejs";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDb = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: any }> };
// Concede os créditos do ciclo pago (idempotente no banco: nunca concede duas vezes o mesmo período).
async function grantCycle(db: AdminDb, subscriptionId: string) {
  const { error } = await db.rpc("viva_grant_subscription_cycle", { p_subscription_id: subscriptionId });
  if (error) throw error;
}
function verify(req: Request, id: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const sig = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(sig.split(",").map(x => { const [k,...v] = x.trim().split("="); return [k,v.join("=")]; }));
  if (!secret || !parts.ts || !parts.v1 || !requestId || !id) return false;
  const expected = createHmac("sha256", secret).update(`id:${id};request-id:${requestId};ts:${parts.ts};`).digest("hex");
  const a = Buffer.from(expected, "hex"), b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && timingSafeEqual(a,b);
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.data?.id || new URL(req.url).searchParams.get("data.id") || "");
    const type = String(body?.type || body?.topic || "");
    if (!verify(req,id)) return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!url || !key || !token) return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 503 });
    const db = createAdmin(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const eventId = String(body?.id || `${type}:${id}:${body?.action || "event"}`);
    const { data: prior } = await db.from("viva_payment_webhook_events").select("id,processed_at").eq("gateway","mercadopago").eq("gateway_event_id",eventId).maybeSingle();
    if (prior?.processed_at) return NextResponse.json({ received:true,duplicate:true });
    if (!prior) {
      const { error } = await db.from("viva_payment_webhook_events").insert({ gateway:"mercadopago",gateway_event_id:eventId,event_type:type,resource_id:id,payload:body });
      if (error && error.code !== "23505") throw error;
    }
    if (type === "payment") {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const p = await res.json(); if (!res.ok) throw new Error("Falha ao consultar pagamento");
      const map:Record<string,string> = {approved:"approved",pending:"pending",in_process:"in_process",rejected:"rejected",cancelled:"cancelled",refunded:"refunded",charged_back:"refunded"};
      const status = map[p.status] || "pending";
      const { data: paymentRow, error: lookupError } = await db.from("viva_payments").select("id,user_id,plan_id,external_reference,metadata,subscription_id").eq("gateway_payment_id",String(p.id)).maybeSingle();
      if (lookupError) throw lookupError;
      // Se o webhook chegar antes de o checkout terminar de gravar o pedido,
      // não marque o evento como concluído: o Mercado Pago poderá reenviá-lo.
      if (!paymentRow && String(p.external_reference || "").startsWith("viva_")) {
        throw new Error("Pedido VIVA+ ainda não encontrado para este pagamento; aguardar nova tentativa do webhook.");
      }
      if (paymentRow) {
        const { error } = await db.from("viva_payments").update({status,paid_at:status==="approved"?(p.date_approved || new Date().toISOString()):null,refunded_at:status==="refunded"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",paymentRow.id);
        if (error) throw error;
        if (status === "approved" && !paymentRow.subscription_id) {
          const { data: existing, error: existingError } = await db.from("viva_subscriptions").select("id").eq("external_reference",paymentRow.external_reference).maybeSingle();
          if (existingError) throw existingError;
          let subscriptionId = existing?.id as string | undefined;
          if (!subscriptionId) {
            const now = new Date(), end = new Date(now);
            const interval = paymentRow.metadata?.requested_interval === "annual" ? "annual" : "monthly";
            end.setDate(end.getDate() + (interval === "annual" ? 365 : 30));
            const { data: sub, error: subError } = await db.from("viva_subscriptions").insert({
              user_id:paymentRow.user_id,plan_id:paymentRow.plan_id,status:"active",billing_interval:interval,
              gateway:"mercadopago",payment_method:"pix",external_reference:paymentRow.external_reference,
              current_period_start:now.toISOString(),current_period_end:end.toISOString()
            }).select("id").single();
            if (subError) throw subError;
            subscriptionId = sub.id;
          }
          const { error: linkError } = await db.from("viva_payments").update({subscription_id:subscriptionId}).eq("id",paymentRow.id);
          if (linkError) throw linkError;
          await grantCycle(db, subscriptionId!);
          // Plano liberado: se a pessoa já ligou o WhatsApp, a VIVA avisa por lá e lembra todas as funções.
          await notifyWhatsappPlanActive(db, paymentRow.user_id);
          // "Venda aprovada!" no celular dos administradores.
          await notifySale(db, { key: "pay:" + p.id, userId: paymentRow.user_id, planId: paymentRow.plan_id, amount: Number(p.transaction_amount || 0), method: "pix", offer: String(paymentRow.external_reference || "").includes("_pro1990") });
        }
        if (status === "approved" && paymentRow.subscription_id) await grantCycle(db, paymentRow.subscription_id);
        if (status === "refunded" && paymentRow.subscription_id) {
          // Estorno/chargeback: encerra o período pago; a carteira volta ao Free na sincronização.
          const { error: endError } = await db.from("viva_subscriptions").update({status:"expired",current_period_end:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",paymentRow.subscription_id);
          if (endError) throw endError;
          await grantCycle(db, paymentRow.subscription_id);
        }
      }
    } else if (type === "subscription_preapproval") {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const s = await res.json(); if (!res.ok) throw new Error("Falha ao consultar assinatura");
      // A autorização do cartão NÃO ativa o Pro: a ativação acontece só quando a cobrança é aprovada
      // (evento subscription_authorized_payment). Status gravados seguem o CHECK da tabela.
      const { data: sub, error: subLookupError } = await db.from("viva_subscriptions").select("id,status").eq("gateway_subscription_id",String(s.id)).maybeSingle();
      if (subLookupError) throw subLookupError;
      if (sub) {
        const next = s.status==="cancelled" ? "canceled" : s.status==="paused" ? "past_due" : sub.status;
        if (next !== sub.status) {
          const { error } = await db.from("viva_subscriptions").update({status:next,updated_at:new Date().toISOString()}).eq("id",sub.id);
          if (error) throw error;
          await grantCycle(db, sub.id);
        }
      }
    } else if (type === "subscription_authorized_payment") {
      const res = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const invoice = await res.json(); if (!res.ok) throw new Error("Falha ao consultar fatura");
      if (invoice.preapproval_id && invoice.status === "approved") {
        const { data: sub, error: subLookupError } = await db.from("viva_subscriptions").select("id,user_id,plan_id,billing_interval,external_reference,status").eq("gateway_subscription_id",String(invoice.preapproval_id)).maybeSingle();
        if (subLookupError) throw subLookupError;
        if (!sub) throw new Error("Assinatura VIVA+ ainda não encontrada para esta cobrança; aguardar nova tentativa do webhook.");
        // Cada cobrança aprovada abre um novo período pago (e um novo ciclo de créditos, uma única vez).
        const start = new Date(invoice.debit_date || invoice.date_created || Date.now());
        const end = new Date(start); if (sub.billing_interval === "annual") end.setFullYear(end.getFullYear()+1); else end.setMonth(end.getMonth()+1);
        const { error } = await db.from("viva_subscriptions").update({status:"active",current_period_start:start.toISOString(),current_period_end:end.toISOString(),updated_at:new Date().toISOString()}).eq("id",sub.id);
        if (error) throw error;
        const amount = Number(invoice.transaction_amount || invoice.amount || 0);
        const { error: payError } = await db.from("viva_payments").upsert({user_id:sub.user_id,subscription_id:sub.id,plan_id:sub.plan_id,gateway:"mercadopago",gateway_payment_id:`preapproval_payment:${invoice.id}`,gateway_subscription_id:String(invoice.preapproval_id),external_reference:`${sub.external_reference||sub.id}:${invoice.id}`,payment_method:"card",billing_interval:sub.billing_interval==="annual"?"annual":"monthly",status:"approved",amount_brl:Number.isFinite(amount)&&amount>0?amount:0,paid_at:start.toISOString(),metadata:{authorized_payment_id:String(invoice.id)}},{onConflict:"gateway,gateway_payment_id"});
        if (payError && payError.code !== "23505") throw payError;
        await grantCycle(db, sub.id);
        // Primeira cobrança aprovada (não as renovações): avisa no WhatsApp e lembra todas as funções.
        if (sub.status !== "active") await notifyWhatsappPlanActive(db, sub.user_id);
        // "Venda aprovada!" (ou "Assinatura renovada!") no celular dos administradores.
        await notifySale(db, { key: "card:" + invoice.id, userId: sub.user_id, planId: sub.plan_id, amount: Number.isFinite(amount) ? amount : 0, method: "card", offer: String(sub.external_reference || "").includes("_pro1990"), renewal: sub.status === "active" });
      }
    }
    await db.from("viva_payment_webhook_events").update({processed_at:new Date().toISOString(),processing_error:null}).eq("gateway","mercadopago").eq("gateway_event_id",eventId);
    return NextResponse.json({received:true});
  } catch(e) { console.error("VIVA MP webhook",e); return NextResponse.json({error:"Falha ao processar notificação."},{status:500}); }
}

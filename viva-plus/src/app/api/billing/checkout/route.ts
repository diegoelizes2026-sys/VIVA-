import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { OFFER_COOKIE, offerDeadline, offerOpen } from "@/lib/funnel-offer";
import { FUNNEL_OFFER, FUNNEL_PRICE_BRL } from "@/lib/life-diagnostic";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
    const body = await req.json();
    const planId = String(body.planId || "");
    const method = String(body.method || "");
    const interval = body.interval === "annual" ? "annual" : "monthly";
    if (!planId || !["pix", "card"].includes(method)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    const { data: plan } = await db.from("viva_plans").select("id,name,monthly_price_brl,annual_price_brl,enabled").eq("id", planId).eq("enabled", true).single();
    if (!plan) return NextResponse.json({ error: "Plano indisponível." }, { status: 404 });
    // Oferta do funil do tráfego pago (Pro mensal por R$19,90): só vale com o prazo assinado e ainda aberto.
    const offer = body.offer === FUNNEL_OFFER ? FUNNEL_OFFER : null;
    if (offer) {
      if (plan.id !== "pro" || interval !== "monthly") return NextResponse.json({ error: "Oferta válida só para o Pro mensal." }, { status: 400 });
      const deadline = offerDeadline((await cookies()).get(OFFER_COOKIE)?.value, user.user_metadata?.funnel_offer_token);
      if (!offerOpen(deadline)) return NextResponse.json({ error: "A promoção especial terminou. O Pro segue disponível pelo preço normal." }, { status: 410 });
    }
    const amount = offer ? FUNNEL_PRICE_BRL : Number(interval === "annual" ? plan.annual_price_brl : plan.monthly_price_brl);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    const planLabel = offer ? `${plan.name} (oferta especial)` : plan.name;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Em testes, use o e-mail da conta compradora de teste do Mercado Pago.
    // Em produção, deixe MERCADOPAGO_TEST_PAYER_EMAIL vazio.
    const payerEmail = process.env.MERCADOPAGO_TEST_PAYER_EMAIL || user.email;
    if (!token) return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 503 });
    if (!serviceRoleKey) return NextResponse.json({ error: "Serviço de pedidos temporariamente indisponível." }, { status: 503 });
    // A gravação é feita no servidor com service role, após autenticar o comprador.
    // Não reabrir INSERT para usuários autenticados nas tabelas de cobrança.
    const adminDb = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const origin = new URL(req.url).origin;
    const external_reference = `viva_${user.id}_${randomUUID()}${offer ? "_" + offer : ""}`;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (method === "card") {
      const mp = await fetch("https://api.mercadopago.com/preapproval", { method: "POST", headers, cache: "no-store", body: JSON.stringify({
        reason: `VIVA+ - Plano ${planLabel}`, external_reference, payer_email: payerEmail,
        back_url: `${origin}/planos?checkout=return`, status: "pending",
        auto_recurring: { frequency: interval === "annual" ? 12 : 1, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" },
        notification_url: `${origin}/api/billing/webhook`
      })});
      const data = await mp.json();
      if (!mp.ok || !data.id || !data.init_point) { console.error("MP preapproval", data); return NextResponse.json({ error: "Falha ao criar assinatura no Mercado Pago." }, { status: 502 }); }
      const { error } = await adminDb.from("viva_subscriptions").insert({ user_id: user.id, plan_id: plan.id, status: "pending", billing_interval: interval, gateway: "mercadopago", gateway_subscription_id: String(data.id), gateway_checkout_url: data.init_point, payment_method: "card", external_reference });
      if (error) { console.error(error); return NextResponse.json({ error: "Não foi possível registrar a assinatura." }, { status: 500 }); }
      return NextResponse.json({ checkoutUrl: data.init_point });
    }
    // Reaproveita o Pix ainda válido do mesmo plano: quem sai para abrir o banco e volta encontra o mesmo código.
    const { data: open } = await adminDb.from("viva_payments").select("gateway_payment_id,pix_qr_code,pix_qr_code_base64,pix_expires_at,metadata")
      .eq("user_id", user.id).eq("plan_id", plan.id).eq("payment_method", "pix").eq("status", "pending").eq("amount_brl", amount)
      .gt("pix_expires_at", new Date(Date.now() + 10 * 60000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (open?.pix_qr_code && (open.metadata as { requested_interval?: string } | null)?.requested_interval === interval) {
      return NextResponse.json({ paymentId: String(open.gateway_payment_id), pixCopyPaste: open.pix_qr_code, qrCodeBase64: open.pix_qr_code_base64 || null, expiresAt: open.pix_expires_at || null, planName: plan.name, amount, reused: true });
    }
    const mp = await fetch("https://api.mercadopago.com/v1/payments", { method: "POST", headers: { ...headers, "X-Idempotency-Key": external_reference }, cache: "no-store", body: JSON.stringify({
      transaction_amount: amount, description: `VIVA+ - Plano ${planLabel}`, payment_method_id: "pix",
      payer: { email: payerEmail }, external_reference, notification_url: `${origin}/api/billing/webhook`
    })});
    const payment = await mp.json();
    const tx = payment.point_of_interaction?.transaction_data;
    if (!mp.ok || !payment.id || !tx?.qr_code) { console.error("MP pix", payment); return NextResponse.json({ error: "Não foi possível gerar o Pix." }, { status: 502 }); }
    const { error } = await adminDb.from("viva_payments").insert({ user_id: user.id, plan_id: plan.id, gateway: "mercadopago", gateway_payment_id: String(payment.id), external_reference, payment_method: "pix", billing_interval: "one_time", status: "pending", amount_brl: amount, pix_qr_code: tx.qr_code, pix_qr_code_base64: tx.qr_code_base64 || null, pix_expires_at: payment.date_of_expiration || null, metadata: { plan_name: plan.name, requested_interval: interval, ...(offer ? { offer } : {}) } });
    if (error) { console.error(error); return NextResponse.json({ error: "Pix gerado, mas não foi possível salvar o pedido." }, { status: 500 }); }
    return NextResponse.json({ paymentId: String(payment.id), pixCopyPaste: tx.qr_code, qrCodeBase64: tx.qr_code_base64 || null, expiresAt: payment.date_of_expiration || null, planName: plan.name, amount });
  } catch (e) { console.error("checkout", e); return NextResponse.json({ error: "Erro ao iniciar pagamento." }, { status: 500 }); }
}

// GET ?paymentId=… → situação do Pix (a tela consulta enquanto a pessoa paga).
// GET sem parâmetro → Pix pendente e ainda válido da pessoa (para retomar o pagamento).
export async function GET(req: Request) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
    const adminDb = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const paymentId = new URL(req.url).searchParams.get("paymentId");
    if (!paymentId) {
      const { data: open } = await adminDb.from("viva_payments").select("gateway_payment_id,plan_id,amount_brl,pix_qr_code,pix_qr_code_base64,pix_expires_at,metadata")
        .eq("user_id", user.id).eq("payment_method", "pix").eq("status", "pending").gt("pix_expires_at", new Date(Date.now() + 5 * 60000).toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!open?.pix_qr_code) return NextResponse.json({ pending: null });
      const { data: active } = await adminDb.from("viva_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
      if (active) return NextResponse.json({ pending: null });
      const meta = (open.metadata || {}) as { plan_name?: string; requested_interval?: string };
      return NextResponse.json({ pending: { paymentId: String(open.gateway_payment_id), planId: open.plan_id, planName: meta.plan_name || "", interval: meta.requested_interval === "annual" ? "annual" : "monthly", amount: Number(open.amount_brl), pixCopyPaste: open.pix_qr_code, qrCodeBase64: open.pix_qr_code_base64 || null, expiresAt: open.pix_expires_at } });
    }
    const { data: row } = await adminDb.from("viva_payments").select("status").eq("user_id", user.id).eq("gateway_payment_id", paymentId).maybeSingle();
    if (!row) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    let status = String(row.status);
    // Se o aviso do Mercado Pago ainda não chegou, confere direto (só leitura; quem libera o plano é o webhook).
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (status === "pending" && token) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) { const p = await r.json(); if (p.status === "approved") status = "approved"; else if (p.status === "cancelled" || p.status === "rejected") status = p.status; }
    }
    return NextResponse.json({ status });
  } catch (e) { console.error("checkout status", e); return NextResponse.json({ error: "Erro ao consultar pagamento." }, { status: 500 }); }
}

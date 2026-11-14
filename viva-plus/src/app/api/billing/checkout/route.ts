import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
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
    const amount = Number(interval === "annual" ? plan.annual_price_brl : plan.monthly_price_brl);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) return NextResponse.json({ error: "Mercado Pago não configurado." }, { status: 503 });
    const origin = new URL(req.url).origin;
    const external_reference = `viva_${user.id}_${randomUUID()}`;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (method === "card") {
      const mp = await fetch("https://api.mercadopago.com/preapproval", { method: "POST", headers, cache: "no-store", body: JSON.stringify({
        reason: `VIVA+ - Plano ${plan.name}`, external_reference, payer_email: user.email,
        back_url: `${origin}/planos?checkout=return`, status: "pending",
        auto_recurring: { frequency: interval === "annual" ? 12 : 1, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" },
        notification_url: `${origin}/api/billing/webhook`
      })});
      const data = await mp.json();
      if (!mp.ok || !data.id || !data.init_point) { console.error("MP preapproval", data); return NextResponse.json({ error: "Falha ao criar assinatura no Mercado Pago." }, { status: 502 }); }
      const { error } = await db.from("viva_subscriptions").insert({ user_id: user.id, plan_id: plan.id, status: "pending", billing_interval: interval, gateway: "mercadopago", gateway_subscription_id: String(data.id), gateway_checkout_url: data.init_point, payment_method: "card", external_reference });
      if (error) { console.error(error); return NextResponse.json({ error: "Não foi possível registrar a assinatura." }, { status: 500 }); }
      return NextResponse.json({ checkoutUrl: data.init_point });
    }
    const mp = await fetch("https://api.mercadopago.com/v1/payments", { method: "POST", headers: { ...headers, "X-Idempotency-Key": external_reference }, cache: "no-store", body: JSON.stringify({
      transaction_amount: amount, description: `VIVA+ - Plano ${plan.name}`, payment_method_id: "pix",
      payer: { email: user.email }, external_reference, notification_url: `${origin}/api/billing/webhook`
    })});
    const payment = await mp.json();
    const tx = payment.point_of_interaction?.transaction_data;
    if (!mp.ok || !payment.id || !tx?.qr_code) { console.error("MP pix", payment); return NextResponse.json({ error: "Não foi possível gerar o Pix." }, { status: 502 }); }
    const { error } = await db.from("viva_payments").insert({ user_id: user.id, plan_id: plan.id, gateway: "mercadopago", gateway_payment_id: String(payment.id), external_reference, payment_method: "pix", billing_interval: "one_time", status: "pending", amount_brl: amount, pix_qr_code: tx.qr_code, pix_qr_code_base64: tx.qr_code_base64 || null, pix_expires_at: payment.date_of_expiration || null, metadata: { plan_name: plan.name, requested_interval: interval } });
    if (error) { console.error(error); return NextResponse.json({ error: "Pix gerado, mas não foi possível salvar o pedido." }, { status: 500 }); }
    return NextResponse.json({ paymentId: String(payment.id), pixCopyPaste: tx.qr_code, qrCodeBase64: tx.qr_code_base64 || null, expiresAt: payment.date_of_expiration || null });
  } catch (e) { console.error("checkout", e); return NextResponse.json({ error: "Erro ao iniciar pagamento." }, { status: 500 }); }
}

import RecordForm from "@/components/record-form";
import FinanceRefresh from "@/components/finance-refresh";
import FinanceFocus from "@/components/finance-focus";
import PaydayCard from "@/components/payday-card";
import MoneyHero from "@/components/money-hero";
import QuickActions from "@/components/quick-actions";
import TxList, { type Tx } from "@/components/tx-list";
import { createClient } from "@/lib/supabase/server";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const shift = (month: string, n: number) => { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

export default async function Page({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams; const now = new Date();
  const current = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(now);
  const month = /^\d{4}-\d{2}$/.test(params.month || "") ? params.month! : current;
  const start = month + "-01"; const [year, mon] = month.split("-").map(Number); const end = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 10);
  const s = await createClient(); const { data: { user } } = await s.auth.getUser();
  const { data, error } = await s.from("viva_transactions").select("id,user_id,kind,description,amount,occurred_on,category,payment_method,source").eq("user_id", user?.id || "").gte("occurred_on", start).lt("occurred_on", end).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(12000));
  if (error) console.error("Meu dinheiro: falha ao carregar lançamentos", error);
  const rows = data || []; const sum = (kind: string) => rows.filter(x => x.kind === kind).reduce((a, x) => a + Number(x.amount), 0);
  const isCurrent = month === current;
  const monthName = `${MONTHS[mon - 1]}${year !== Number(current.slice(0, 4)) ? ` de ${year}` : ""}`;

  return <div className="viva-finance-scroll"><FinanceRefresh /><div className="vx-page">
    <MoneyHero greeting="Meu dinheiro" subtitle={isCurrent ? "Este mês" : monthName.replace(/^./, c => c.toUpperCase())} label={`Saldo de ${monthName}`} balance={sum("income") - sum("expense")} income={sum("income")} expense={sum("expense")} />
    <nav className="vx-months" aria-label="Escolher mês">
      <a href={`/financas?month=${shift(month, -1)}`} aria-label="Mês anterior">‹</a>
      <b>{monthName.replace(/^./, c => c.toUpperCase())}{isCurrent ? <small>Mês atual</small> : <a href="/financas">Voltar para este mês</a>}</b>
      {!isCurrent ? <a href={`/financas?month=${shift(month, 1)}`} aria-label="Próximo mês">›</a> : <span aria-hidden />}
    </nav>
    <QuickActions exclude={["Lançar gasto", "Saúde", "Perto de mim"]} />
    <PaydayCard />
    <FinanceFocus />
    <div className="vx-split">
      <section className="vx-card">
        <div className="vx-card-head"><h2>Lançamentos de {monthName}</h2><small className="vx-count">{rows.length}</small></div>
        <TxList rows={rows as Tx[]} empty="Nenhum lançamento neste mês." />
      </section>
      <section className="vx-card" id="novo-lancamento">
        <div className="vx-card-head"><h2>Novo lançamento</h2></div>
        <RecordForm table="transactions" fields={[{ name: "kind", label: "Tipo", options: ["income", "expense"], required: true }, { name: "description", label: "Descrição", required: true }, { name: "amount", label: "Valor (R$)", type: "number", required: true }, { name: "occurred_on", label: "Data", type: "date", required: true }, { name: "category", label: "Categoria", options: ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Contas", "Renda", "Outros"] }, { name: "payment_method", label: "Forma de pagamento", options: ["Pix", "Dinheiro", "Débito", "Crédito", "Transferência", "Outro"] }]} />
      </section>
    </div>
  </div></div>;
}

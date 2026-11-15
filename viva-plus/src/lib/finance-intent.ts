export type TransactionClarification={amount:number|null;description:string;category:string;occurred_on:string;payment_method:string};
function parseAmount(raw:string){const normalized=raw.replace(/\./g,"").replace(",",".");const multiplier=/\s*(mil|k)$/i.test(raw)?1000:1;const numeric=Number(normalized.replace(/\s*(mil|k)$/i,""));return Number.isFinite(numeric)&&numeric>0?numeric*multiplier:null}
export function extractMoneyAmount(text:string){const match=text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*(mil|k))?/i);if(!match)return null;const suffix=match[2]||"";return parseAmount(match[1]+(suffix?" "+suffix:""))}
export function parseTransactionIntent(message:string){const text=message.toLowerCase();const amountMatch=text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*(mil|k))?/i);if(!amountMatch)return null;const amount=parseAmount(amountMatch[1]+(amountMatch[2]?" "+amountMatch[2]:""));if(!amount)return null;const income=/\b(recebi|ganhei|sal[aá]rio|renda|entrou|pix recebido)\b/.test(text);const expense=/\b(despesa|gastei|paguei|comprei|paguei por)\b/.test(text);const kind=income&&!expense?"income":expense&&!income?"expense":null;let category="Outros";if(/aluguel|moradia/.test(text))category="Moradia";else if(/mercado|supermercado|comida/.test(text))category="Alimentação";else if(/luz|água|internet|telefone/.test(text))category="Contas";else if(/sal[aá]rio|renda/.test(text))category="Renda";else if(/uber|ônibus|combustível|moto|carro/.test(text))category="Transporte";const description=text.replace(/\b(anote|anotar|registra|registrar|recebi|ganhei|gastei|paguei|comprei|despesa|receita|pix recebido)\b/g,"").replace(amountMatch[0],"").replace(/\b(de|do|da|no|na|em)\b/g,"").trim()||category;const cleanDescription=description[0].toUpperCase()+description.slice(1);const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const base={amount,description:cleanDescription,category,occurred_on:today,payment_method:"Outro"};if(!kind)return {clarification:base};return {transactionDraft:{...base,kind}}}

export type SavingsGoalIntent={title:string;target_amount:number};
export function parseSavingsGoalIntent(message:string):SavingsGoalIntent|null{
 const text=message.trim().toLowerCase();
 if(!/\b(quero|preciso|pretendo|vou|minha meta|meu objetivo|objetivo|meta|juntar|guardar|poupar|economizar|reservar)\b/.test(text))return null;
 if(/\b(gastei|paguei|comprei|recebi|ganhei|sal[aá]rio|pix recebido|despesa|receita)\b/.test(text))return null;
 const amount=extractMoneyAmount(text);
 if(!amount||amount<=0)return null;
 const goalWords=text
  .replace(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*(?:mil|k))?/i," ")
  .replace(/\b(quero|preciso|pretendo|vou|minha meta|meu objetivo|objetivo|meta|juntar|guardar|poupar|economizar|reservar|para|pra|de|do|da|um|uma|o|a|até|em|no|na)\b/g," ")
  .replace(/\b(5|10|15|20|30|60|90)\s*dias?\b/g," ")
  .replace(/\s+/g," ").replace(/^[,;:\s-]+|[,;:\s-]+$/g,"").trim();
 if(!goalWords)return null;
 const title=goalWords.length>0?goalWords[0].toUpperCase()+goalWords.slice(1):"Minha meta";
 return {title:title.slice(0,90),target_amount:amount};
}

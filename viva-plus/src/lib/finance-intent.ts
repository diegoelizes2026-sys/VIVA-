export type TransactionClarification={amount:number|null;description:string;category:string;occurred_on:string;payment_method:string};
function parseAmount(raw:string){const normalized=raw.replace(/\./g,"").replace(",",".");const multiplier=/\s*(mil|k)$/i.test(raw)?1000:1;const numeric=Number(normalized.replace(/\s*(mil|k)$/i,""));return Number.isFinite(numeric)&&numeric>0?numeric*multiplier:null}
export function extractMoneyAmount(text:string){const match=text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*(mil|k))?/i);if(!match)return null;const suffix=match[2]||"";return parseAmount(match[1]+(suffix?" "+suffix:""))}
const W=(body:string,flags="")=>new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`,"u"+flags);
// Entende "gastei 20 no lanche", "lanche 20", "recebi 1500 de salário", "caiu o pix de 50"... sem perguntar à toa.
// Só pede "despesa ou receita?" quando é ambíguo de verdade (ex.: "pix 50", "transferência 100").
const INCOME_RE=W(String.raw`recebi|receber|recebido|recebimento|ganhei|ganho|ganhamos|entrou|entraram|entrada|caiu|ca[ií]ram|sal[aá]rio|renda|vendi|vendemos|venda|me pagou|me pagaram|me deu|me deram|me devolveu|me devolveram|devolu[cç][aã]o|reembolso|estorno|freela|freelance|bico|comiss[aã]o|gorjeta|pix recebido|rendimento|rendeu|lucrei|lucro|faturei|mesada|pens[aã]o|aposentadoria|benef[ií]cio|bolsa fam[ií]lia|13[ºo]?|d[eé]cimo terceiro|f[eé]rias|adiantamento|vale`);
const EXPENSE_RE=W(String.raw`gastei|gasto|gastamos|paguei|pagamos|pagando|comprei|compramos|compra|comprinha|torrei|despesa|saiu|sa[ií]da|debitou|debitaram|descontou|transferi|mandei|enviei|fiz um pix|fiz pix|pixei|abasteci|almocei|jantei|lanchei|tomei|assinei|parcela|fatura|boleto|multa|aluguel|conta de|mercado|feira|padaria|farm[aá]cia|rem[eé]dio|uber|99|[ôo]nibus|passagem|gasolina|combust[ií]vel|ifood|delivery|lanche|almo[cç]o|janta|jantar|caf[eé]|pizza|a[cç]a[ií]|cerveja|bar|cinema|academia|internet|luz|[aá]gua|g[aá]s|celular|recarga|cabelo|unha|roupa|t[eê]nis|presente`);
const AMBIGUOUS_RE=W(String.raw`pix|transfer[eê]ncia|ted|doc|dep[oó]sito`);
const QUESTION_RE=new RegExp(String.raw`\?|^\s*(?:quanto|quantos|quanta|qual|quais|como|posso|pode|podia|devo|vale|onde|quando|ser[aá]|o que|oque|me ajuda|ajuda|quero|preciso|pretendo|vou|meta|objetivo|juntar|guardar|economizar|tenho que pagar|preciso pagar)(?![\p{L}\p{N}])`,"u");
const CATEGORY_RULES:[RegExp,string][]=[
 [W(String.raw`sal[aá]rio|renda|freela|freelance|bico|comiss[aã]o|vendi|venda|mesada|pens[aã]o|aposentadoria|benef[ií]cio|lucro|faturei|13|d[eé]cimo|f[eé]rias|adiantamento|reembolso|estorno`),"Renda"],
 [W(String.raw`mercado|supermercado|feira|a[cç]ougue|hortifruti|atacad[aã]o`),"Mercado"],
 [W(String.raw`lanche|lanchei|almo[cç]o|almocei|janta|jantar|jantei|caf[eé]|padaria|p[aã]o|pizza|hamb[uú]rguer|a[cç]a[ií]|ifood|delivery|restaurante|comida|marmita|sorvete|doce|salgado|refri|refrigerante`),"Alimentação"],
 [W(String.raw`uber|99|t[aá]xi|[ôo]nibus|metr[ôo]|passagem|gasolina|combust[ií]vel|abasteci|[áa]lcool|etanol|estacionamento|ped[aá]gio|moto|carro|oficina|mec[aâ]nico|bicicleta`),"Transporte"],
 [W(String.raw`aluguel|condom[ií]nio|iptu|reforma|m[oó]veis?|moradia`),"Moradia"],
 [W(String.raw`luz|energia|[aá]gua|internet|wi-?fi|telefone|celular|recarga|g[aá]s|conta de|boleto`),"Contas"],
 [W(String.raw`farm[aá]cia|rem[eé]dio|m[eé]dico|consulta|exame|dentista|plano de sa[uú]de|academia|psic[oó]log`),"Saúde"],
 [W(String.raw`cinema|show|bar|cerveja|festa|rol[eê]|viagem|passeio|jogo|netflix|spotify|streaming|ingresso|balada`),"Lazer"],
 [W(String.raw`curso|faculdade|escola|livro|material escolar|mensalidade`),"Educação"],
 [W(String.raw`fatura|cart[aã]o|parcela|empr[eé]stimo|d[ií]vida|acordo|juros`),"Dívidas"],
 [W(String.raw`roupa|t[eê]nis|sapato|camisa|cal[cç]a|shopping|loja|presente|eletr[oô]nico|cabelo|unha|perfume|maquiagem|shopee|mercado livre|amazon`),"Compras"],
];
const STOP_RE=W(String.raw`fiz um pix|fiz pix|fiz|ontem|anteontem|me pagaram|me pagou|pagaram|pagou|anote|anota|anotar|registra|registre|registrar|lan[cç]a|lan[cç]ar|coloca|recebi|receber|recebido|ganhei|ganho|gastei|gasto|paguei|pago|comprei|compra|despesa|receita|entrou|caiu|o|a|os|as|um|uma|de|do|da|dos|das|no|na|nos|nas|em|com|pra|para|pro|por|reais|real|conto|contos|pila|r\$|hoje|agora|eu|me|meu|minha|foi|e|que`,"g");
export function parseTransactionIntent(message:string){
 const text=message.toLowerCase().normalize("NFC").trim();
 if(QUESTION_RE.test(text))return null;
 const amountMatch=text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(mil|k)\b)?/i);if(!amountMatch)return null;
 const amount=parseAmount(amountMatch[1].replace(/^(\d+)\.(\d{1,2})$/,"$1,$2")+(amountMatch[2]?" "+amountMatch[2]:""));if(!amount)return null;
 const rest=text.replace(amountMatch[0]," ");
 const income=INCOME_RE.test(rest), expenseWord=EXPENSE_RE.test(rest);
 const words=rest.replace(STOP_RE," ").replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/\s+/g," ").trim();
 let kind:"income"|"expense"|null=income&&!expenseWord?"income":expenseWord&&!income?"expense":null;
 // "me pagou 50" / "recebi do mercado" etc.: verbo de entrada vence palavra de gasto.
 if(income&&expenseWord)kind=W(String.raw`recebi|ganhei|entrou|caiu|me pagou|me pagaram|vendi|reembolso|estorno|devolveu`).test(rest)?"income":W(String.raw`gastei|paguei|comprei|torrei|transferi|mandei|enviei|fiz um pix|fiz pix`).test(rest)?"expense":null;
 // Sem verbo: "lanche 20", "uber 15" → gasto (o mais comum). Só pergunta se for ambíguo ("pix 50") ou não disser o quê.
 if(!kind&&!AMBIGUOUS_RE.test(rest)&&words&&words.split(" ").length<=6)kind="expense";
 let category=kind==="income"?"Renda":"Outros";
 for(const [re,cat] of CATEGORY_RULES){if(re.test(rest)&&(kind!=="income"||cat==="Renda")){category=cat;break}}
 if(kind==="expense"&&category==="Renda")category="Outros";
 const description=(words||(kind==="income"?"Entrada":category)).slice(0,80);
 const cleanDescription=description[0].toUpperCase()+description.slice(1);
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const occurred_on=W("ontem").test(text)?new Date(Date.parse(today+"T12:00:00Z")-86400000).toISOString().slice(0,10):today;
 const payment_method=W("pix").test(text)?"Pix":W("cart[aã]o de cr[eé]dito|no cr[eé]dito|cr[eé]dito").test(text)?"Crédito":W("d[eé]bito").test(text)?"Débito":W("dinheiro|esp[eé]cie").test(text)?"Dinheiro":"Outro";
 const base={amount,description:cleanDescription,category,occurred_on,payment_method};
 if(!kind)return {clarification:base};
 return {transactionDraft:{...base,kind}};
}

export type SavingsGoalIntent={title:string;target_amount:number};
export function parseSavingsGoalIntent(message:string):SavingsGoalIntent|null{
 const text=message.trim().toLowerCase();
 if(!/\b(quero|preciso|pretendo|vou|minha meta|meu objetivo|objetivo|meta|juntar|guardar|poupar|economizar|reservar)\b/.test(text))return null;
 if(/\b(gastei|paguei|comprei|recebi|ganhei|sal[aá]rio|pix recebido|despesa|receita)\b/.test(text))return null;
 const amount=extractMoneyAmount(text);
 if(!amount||amount<=0)return null;
 let goalWords=text.replace(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*(?:mil|k))?/i," ");
 goalWords=goalWords.replace(/\b(quero|preciso|pretendo|vou|minha meta|meu objetivo|objetivo|meta|juntar|junto|junta|guardar|guardo|guarda|poupar|poupo|economizar|reservar|para|pra|de|do|da|até|em|no|na)\b/g," ");
 goalWords=goalWords.replace(/\bcompra\b/g,"comprar").replace(/[“”".,!?;:]+/g," ").replace(/\s+/g," ").replace(/^[,;:\s-]+|[,;:\s-]+$/g,"").trim();
 if(!goalWords)return null;
 const title=goalWords[0].toUpperCase()+goalWords.slice(1);
 return {title:title.slice(0,90),target_amount:amount};
}

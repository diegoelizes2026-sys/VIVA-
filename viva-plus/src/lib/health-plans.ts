export type HealthGoal = "hipertrofia" | "emagrecimento" | "condicionamento" | "saude";
export type Exercise = { name: string; sets: string; reps: string; rest: string };
export type WorkoutDay = { short: string; focus: string; rest?: boolean; exercises: Exercise[] };

export const GOALS: { id: HealthGoal; label: string; plan: string; hint: string }[] = [
  { id: "emagrecimento", label: "Perder peso", plan: "Emagrecimento", hint: "Treino metabólico + cardio" },
  { id: "hipertrofia", label: "Ganhar massa", plan: "Hipertrofia", hint: "Divisão por grupo muscular" },
  { id: "condicionamento", label: "Condicionamento", plan: "Condicionamento", hint: "Fôlego, força e corrida" },
  { id: "saude", label: "Saúde geral", plan: "Saúde e bem-estar", hint: "Leve, constante e seguro" },
];

const WARMUP: Exercise = { name: "Aquecimento (polichinelo + mobilidade)", sets: "1", reps: "5 min", rest: "—" };
const ex = (name: string, sets: string, reps: string, rest: string): Exercise => ({ name, sets, reps, rest });
const REST_DAY: WorkoutDay = { short: "Descanso", focus: "Descanso", rest: true, exercises: [ex("Alongamento leve e caminhada livre", "1", "15 min", "—")] };

export const PLANS: Record<HealthGoal, WorkoutDay[]> = {
  hipertrofia: [
    { short: "Costas", focus: "Costas e bíceps", exercises: [WARMUP, ex("Remada curvada com halteres", "4", "10–12", "75s"), ex("Puxada alta (ou remada com elástico)", "4", "10–12", "75s"), ex("Remada unilateral", "3", "12", "60s"), ex("Rosca direta", "3", "12", "60s"), ex("Prancha", "3", "30–40s", "45s")] },
    { short: "Peito", focus: "Peito e tríceps", exercises: [WARMUP, ex("Supino com halteres (ou flexão)", "4", "8–12", "90s"), ex("Supino inclinado", "3", "10–12", "75s"), ex("Crucifixo", "3", "12", "60s"), ex("Tríceps francês", "3", "12", "60s"), ex("Mergulho no banco", "3", "10–15", "60s")] },
    { short: "Pernas", focus: "Pernas e glúteos", exercises: [WARMUP, ex("Agachamento livre", "4", "10–12", "90s"), ex("Afundo alternado", "3", "10 cada perna", "75s"), ex("Stiff com halteres", "3", "12", "75s"), ex("Elevação pélvica", "3", "15", "60s"), ex("Panturrilha em pé", "4", "15–20", "45s")] },
    { short: "Ombros", focus: "Ombros e abdômen", exercises: [WARMUP, ex("Desenvolvimento com halteres", "4", "10–12", "75s"), ex("Elevação lateral", "3", "12–15", "60s"), ex("Elevação frontal", "3", "12", "60s"), ex("Crucifixo invertido", "3", "12–15", "60s"), ex("Abdominal remador", "3", "15", "45s")] },
    { short: "Braços", focus: "Bíceps e tríceps", exercises: [WARMUP, ex("Rosca alternada", "4", "10–12", "60s"), ex("Rosca martelo", "3", "12", "60s"), ex("Tríceps testa", "4", "10–12", "60s"), ex("Tríceps coice", "3", "12", "60s"), ex("Flexão fechada", "3", "até a falha", "60s")] },
    { short: "Cardio", focus: "Cardio e core", exercises: [WARMUP, ex("Caminhada rápida ou bike", "1", "25–30 min", "—"), ex("Prancha lateral", "3", "25s cada lado", "40s"), ex("Abdominal bicicleta", "3", "20", "40s")] },
    REST_DAY,
  ],
  emagrecimento: [
    { short: "Full A", focus: "Corpo inteiro A", exercises: [WARMUP, ex("Agachamento", "3", "15", "45s"), ex("Flexão (pode apoiar os joelhos)", "3", "10–12", "45s"), ex("Remada com elástico/halter", "3", "15", "45s"), ex("Afundo", "3", "12 cada perna", "45s"), ex("Prancha", "3", "30s", "30s")] },
    { short: "Cardio", focus: "Cardio moderado", exercises: [WARMUP, ex("Caminhada rápida, bike ou elíptico", "1", "35–40 min", "—"), ex("Alongamento final", "1", "5 min", "—")] },
    { short: "Full B", focus: "Corpo inteiro B", exercises: [WARMUP, ex("Levantamento terra com halteres", "3", "12", "60s"), ex("Desenvolvimento de ombros", "3", "12", "45s"), ex("Elevação pélvica", "3", "15", "45s"), ex("Polichinelo", "3", "45s", "30s"), ex("Abdominal infra", "3", "15", "30s")] },
    { short: "HIIT", focus: "Intervalado (HIIT)", exercises: [WARMUP, ex("Corrida/bike forte 30s + leve 60s", "8", "rodadas", "—"), ex("Agachamento com salto (ou sem salto)", "3", "12", "45s"), ex("Mountain climber", "3", "30s", "30s")] },
    { short: "Full C", focus: "Circuito metabólico", exercises: [WARMUP, ex("Circuito: agachamento + flexão + remada + afundo", "4", "voltas de 12 reps", "90s entre voltas"), ex("Prancha com toque no ombro", "3", "20", "30s")] },
    { short: "Caminhada", focus: "Caminhada ao ar livre", exercises: [ex("Caminhada leve a moderada", "1", "45–60 min", "—")] },
    REST_DAY,
  ],
  condicionamento: [
    { short: "Circuito", focus: "Circuito funcional", exercises: [WARMUP, ex("Burpee (ou versão sem salto)", "4", "10", "45s"), ex("Agachamento sumô", "4", "15", "45s"), ex("Flexão", "4", "12", "45s"), ex("Corda ou polichinelo", "4", "45s", "45s")] },
    { short: "Corrida", focus: "Corrida leve", exercises: [WARMUP, ex("Trote leve contínuo", "1", "25–30 min", "—"), ex("Alongamento de pernas", "1", "5 min", "—")] },
    { short: "Força", focus: "Força geral", exercises: [WARMUP, ex("Agachamento búlgaro", "3", "10 cada perna", "60s"), ex("Remada curvada", "3", "12", "60s"), ex("Desenvolvimento", "3", "10", "60s"), ex("Ponte de glúteo unilateral", "3", "12", "45s")] },
    { short: "Tiros", focus: "Intervalado", exercises: [WARMUP, ex("Tiro 1 min forte + 2 min trote", "6", "rodadas", "—"), ex("Prancha", "3", "40s", "30s")] },
    { short: "Core", focus: "Mobilidade e core", exercises: [ex("Mobilidade de quadril e ombros", "1", "10 min", "—"), ex("Dead bug", "3", "12", "30s"), ex("Prancha lateral", "3", "30s cada lado", "30s"), ex("Superman", "3", "15", "30s")] },
    { short: "Longão", focus: "Corrida longa", exercises: [WARMUP, ex("Corrida em ritmo confortável", "1", "40–50 min", "—")] },
    REST_DAY,
  ],
  saude: [
    { short: "Caminhada", focus: "Caminhada + mobilidade", exercises: [ex("Caminhada em ritmo confortável", "1", "30 min", "—"), ex("Mobilidade de coluna e quadril", "1", "8 min", "—")] },
    { short: "Força", focus: "Força leve", exercises: [WARMUP, ex("Sentar e levantar da cadeira", "3", "12", "60s"), ex("Flexão na parede", "3", "12", "60s"), ex("Remada com elástico", "3", "12", "60s"), ex("Elevação de panturrilha", "3", "15", "45s")] },
    { short: "Alongar", focus: "Alongamento e respiração", exercises: [ex("Alongamento de corpo inteiro", "1", "15 min", "—"), ex("Respiração diafragmática", "1", "5 min", "—")] },
    { short: "Força", focus: "Força leve", exercises: [WARMUP, ex("Agachamento parcial", "3", "12", "60s"), ex("Ponte de glúteo", "3", "12", "60s"), ex("Elevação lateral leve", "3", "12", "60s"), ex("Prancha (pode apoiar joelhos)", "3", "20s", "45s")] },
    { short: "Caminhada", focus: "Caminhada", exercises: [ex("Caminhada em ritmo moderado", "1", "35 min", "—")] },
    { short: "Lazer", focus: "Lazer ativo", exercises: [ex("Dança, bike, natação ou esporte", "1", "30–45 min", "—")] },
    REST_DAY,
  ],
};

export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const TIPS = [
  "Beba água antes, durante e depois do treino. Isso melhora seu desempenho e sua recuperação!",
  "Dormir de 7 a 9 horas é quando o músculo se recupera. Sono também é treino!",
  "Constância vence intensidade: 30 minutos todo dia valem mais que 3 horas uma vez por semana.",
  "Inclua proteína em todas as refeições: ovos, frango, peixe, feijão, iogurte.",
  "Sentiu dor aguda? Pare o exercício. Desconforto muscular é normal, dor na articulação não.",
  "Aqueça por 5 minutos antes de começar: reduz o risco de lesão e melhora o rendimento.",
  "Prato colorido = mais vitaminas. Metade do prato com legumes e verduras.",
  "Respire: solte o ar na fase de esforço e puxe na fase de volta.",
];

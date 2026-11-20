import { AsyncLocalStorage } from "node:async_hooks";

// Permite que o servidor execute as rotas da API "como" um usuário (ex.: mensagens vindas do WhatsApp),
// usando o token de acesso dele. Assim valem as mesmas regras de RLS, créditos e validações do app.
const store = new AsyncLocalStorage<{ accessToken: string }>();

export function runAsUser<T>(accessToken: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ accessToken }, fn);
}

export function actingUserToken(): string | null {
  return store.getStore()?.accessToken ?? null;
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Personais parceiros aprovados, primeiro os da cidade de quem está vendo.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: me } = await supabase.from("viva_profiles").select("city,state").eq("id", user.id).maybeSingle();
  const { data, error } = await supabase.rpc("viva_partner_directory", { p_city: me?.city ?? null, p_state: me?.state ?? null, p_limit: 6 });
  if (error) return NextResponse.json({ partners: [], city: me?.city ?? null });
  return NextResponse.json({ partners: data || [], city: me?.city ?? null, state: me?.state ?? null });
}

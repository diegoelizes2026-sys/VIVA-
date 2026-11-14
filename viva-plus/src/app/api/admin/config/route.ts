import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
const schema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("settings"),ai_paused:z.boolean().optional(),automatic_mode:z.boolean().optional(),global_daily_budget_brl:z.number().min(0).max(100000).optional(),usd_brl_rate:z.number().min(0.01).max(1000).optional(),alert_threshold_percent:z.number().int().min(1).max(100).optional()}),
 z.object({kind:z.literal("plan"),id:z.enum(["free","essential","pro"]),monthly_price_brl:z.number().min(0).max(100000).optional(),annual_price_brl:z.number().min(0).max(100000).optional(),daily_credits:z.number().int().min(0).max(10000).optional(),max_output_tokens:z.number().int().min(64).max(16000).optional(),history_messages:z.number().int().min(0).max(40).optional(),model_key:z.enum(["cheap","balanced"]).optional(),radar_enabled:z.boolean().optional(),voice_enabled:z.boolean().optional(),photo_enabled:z.boolean().optional(),priority_enabled:z.boolean().optional(),enabled:z.boolean().optional()})
]);
export async function PUT(request:Request){
 try{
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Não autenticado."},{status:401});
  const {data:isAdmin,error:adminError}=await supabase.rpc("viva_is_admin");if(adminError||!isAdmin)return NextResponse.json({error:"Acesso restrito ao administrador VIVA+."},{status:403});
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Configuração inválida."},{status:400});
  if(parsed.data.kind==="settings"){const {kind,...values}=parsed.data;const {error}=await supabase.from("viva_admin_settings").update({...values,updated_at:new Date().toISOString()}).eq("id",true);if(error)throw error;}
  else{const {kind,id,...values}=parsed.data;const {error}=await supabase.from("viva_plans").update({...values,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw error;}
  return NextResponse.json({ok:true});
 }catch(error){console.error("VIVA admin config error",error);return NextResponse.json({error:"Não foi possível salvar a configuração."},{status:500});}
}

import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 try{
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Não autenticado."},{status:401});
  const {data:isAdmin,error:adminError}=await supabase.rpc("viva_is_admin");
  if(adminError||!isAdmin)return NextResponse.json({error:"Acesso restrito."},{status:403});
  const {data,error}=await supabase.from("viva_admin_alerts").select("id,alert_type,detail,created_at").is("resolved_at",null).order("created_at",{ascending:false}).limit(20);
  if(error)throw error;
  return NextResponse.json({alerts:data||[]});
 }catch(error){console.error("VIVA admin alerts read failed",error);return NextResponse.json({error:"Não foi possível carregar alertas."},{status:500});}
}

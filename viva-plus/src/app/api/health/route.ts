import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

const profileSchema = z.object({
  kind: z.literal("profile"),
  age: z.number().int().min(13).max(110),
  sex: z.enum(["female","male","other"]),
  height_cm: z.number().min(100).max(250),
  current_weight_kg: z.number().min(25).max(350),
  goal_weight_kg: z.number().min(25).max(350).nullable(),
  activity_level: z.enum(["sedentary","light","moderate","high"]),
  water_goal_ml: z.number().int().min(500).max(8000)
});
const waterSchema = z.object({kind:z.literal("water"),amount_ml:z.number().int().min(50).max(2000)});
const weightSchema = z.object({kind:z.literal("weight"),weight_kg:z.number().min(25).max(350)});
const sleepSchema = z.object({kind:z.literal("sleep"),sleep_hours:z.number().min(0.5).max(24),sleep_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
const foodSchema=z.object({kind:z.literal("food"),meal_type:z.enum(["breakfast","lunch","dinner","snack"]),food_name:z.string().trim().min(2).max(120),quantity:z.string().trim().min(1).max(40),calories:z.number().min(0).max(5000).nullable(),protein_g:z.number().min(0).max(500).nullable(),carbs_g:z.number().min(0).max(1000).nullable(),fat_g:z.number().min(0).max(500).nullable(),fiber_g:z.number().min(0).max(200).nullable()});
const activitySchema=z.object({kind:z.literal("activity"),activity_type:z.enum(["walking","running","gym","cycling","sports","yoga","other"]),duration_minutes:z.number().int().min(1).max(1440),intensity:z.enum(["light","moderate","vigorous"]),notes:z.string().trim().max(240).nullable()});
const schema = z.discriminatedUnion("kind",[profileSchema,waterSchema,weightSchema,sleepSchema,foodSchema,activitySchema]);

function localDate() {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export async function GET() {
  try {
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:"Faça login para acessar seus dados."},{status:401});
    const today=localDate();
    const [{data:profile,error:profileError},{data:water,error:waterError},{data:weights,error:weightError},{data:sleep,error:sleepError},{data:foods,error:foodError},{data:activities,error:activityError}]=await Promise.all([
      supabase.from("viva_health_profiles").select("*").eq("user_id",user.id).maybeSingle(),
      supabase.from("viva_water_logs").select("id,amount_ml,created_at").eq("user_id",user.id).eq("logged_on",today).order("created_at",{ascending:false}).limit(50),
      supabase.from("viva_weight_logs").select("id,weight_kg,logged_on").eq("user_id",user.id).order("logged_on",{ascending:false}).limit(12),
      supabase.from("viva_sleep_logs").select("id,sleep_hours,sleep_date").eq("user_id",user.id).order("sleep_date",{ascending:false}).limit(7),
      supabase.from("viva_food_logs").select("id,meal_type,food_name,quantity,calories,protein_g,carbs_g,fat_g,fiber_g,logged_at").eq("user_id",user.id).eq("logged_on",today).order("logged_at",{ascending:false}).limit(100),
      supabase.from("viva_activity_logs").select("id,activity_type,duration_minutes,intensity,notes,logged_at,logged_on").eq("user_id",user.id).order("logged_on",{ascending:false}).limit(30)
    ]);
    const error=profileError||waterError||weightError||sleepError||foodError||activityError;
    if(error)throw error;
    return NextResponse.json({profile,water:water||[],weights:weights||[],sleep:sleep||[],today});
  } catch(error) {
    console.error("VIVA health load failed",error);
    return NextResponse.json({error:"Não foi possível carregar seus dados de bem-estar."},{status:500});
  }
}

export async function POST(request:Request) {
  try {
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:"Faça login para salvar seus dados."},{status:401});
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({error:"Confira os dados informados."},{status:400});
    const data=parsed.data;
    if(data.kind==="profile") {
      const {kind,...values}=data;
      const {data:profile,error}=await supabase.from("viva_health_profiles").upsert({user_id:user.id,...values,updated_at:new Date().toISOString()},{onConflict:"user_id"}).select("*").single();
      if(error)throw error;
      return NextResponse.json({profile,message:"Seu perfil de bem-estar foi salvo."});
    }
    if(data.kind==="water") {
      const {data:log,error}=await supabase.from("viva_water_logs").insert({user_id:user.id,amount_ml:data.amount_ml,logged_on:localDate()}).select("id,amount_ml,created_at").single();
      if(error)throw error;
      return NextResponse.json({log,message:"Água registrada!"});
    }
    if(data.kind==="weight") {
      const {data:log,error}=await supabase.from("viva_weight_logs").insert({user_id:user.id,weight_kg:data.weight_kg}).select("id,weight_kg,logged_on").single();
      if(error)throw error;
      return NextResponse.json({log,message:"Peso registrado."});
    }
    if(data.kind==="food") {
      const {kind,...values}=data;
      const {data:log,error}=await supabase.from("viva_food_logs").insert({user_id:user.id,...values,logged_on:localDate()}).select("*").single();
      if(error)throw error;
      return NextResponse.json({log,message:"Refeição registrada."});
    }
    if(data.kind==="activity") {
      const {kind,...values}=data;
      const {data:log,error}=await supabase.from("viva_activity_logs").insert({user_id:user.id,...values,logged_on:localDate()}).select("*").single();
      if(error)throw error;
      return NextResponse.json({log,message:"Atividade registrada."});
    }
    const {data:log,error}=await supabase.from("viva_sleep_logs").upsert({user_id:user.id,sleep_hours:data.sleep_hours,sleep_date:data.sleep_date},{onConflict:"user_id,sleep_date"}).select("id,sleep_hours,sleep_date").single();
    if(error)throw error;
    return NextResponse.json({log,message:"Sono registrado."});
  } catch(error) {
    console.error("VIVA health save failed",error);
    return NextResponse.json({error:"Não foi possível salvar. Tente novamente."},{status:500});
  }
}

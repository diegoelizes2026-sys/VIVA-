import OpenAI from "openai";
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

export const runtime="nodejs";
export const maxDuration=60;

export async function POST(request:Request){
 try{
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Faça login para gerar a demonstração."},{status:401});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:"Geração de imagens temporariamente indisponível."},{status:503});
  const body=await request.json();
  const exercise=typeof body.exercise==="string"?body.exercise.trim():"";
  const gender=body.gender==="female"?"female":"male";
  if(!exercise||exercise.length>120)return NextResponse.json({error:"Informe um exercício com até 120 caracteres."},{status:400});
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const result=await client.images.generate({
   model:"gpt-image-1",
   prompt:"Create a clear, safe educational fitness instruction illustration for the exercise: "+exercise+". Show one adult "+(gender==="female"?"woman":"man")+" wearing modest neutral athletic clothing, with anatomically plausible proportions, demonstrating the correct movement in two sequential positions side by side (starting position and finishing position). Make posture, alignment and range of motion easy to understand. Clean light neutral studio background, professional sports education illustration, full body visible, no text, no labels, no logos, no watermark. Do not depict unsafe form. If the exercise name is ambiguous, depict a conservative common version.",
   size:"1024x1024",
   quality:"low"
  });
  const image=result.data?.[0]?.b64_json;
  if(!image)return NextResponse.json({error:"A OpenAI não retornou uma imagem desta vez."},{status:502});
  return NextResponse.json({image:"data:image/png;base64,"+image});
 }catch(error){
  console.error("VIVA Personal exercise image error",error);
  return NextResponse.json({error:"Não foi possível gerar a imagem agora. Tente novamente em instantes."},{status:500});
 }
}

import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {createTransaction} from "@/lib/transactions";
export const runtime="nodejs";
const schema=z.object({kind:z.enum(["income","expense"]),amount:z.coerce.number().positive(),description:z.string().trim().min(1).max(240),occurred_on:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),category:z.string().optional(),payment_method:z.string().optional(),source:z.enum(["manual","viva"]).optional(),isReceipt:z.boolean().optional(),receiptUploadId:z.string().uuid().optional()});
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g," ").trim();
export async function POST(req:Request){
 try{
  const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({error:"Faça login para salvar o lançamento."},{status:401});
  const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Dados do lançamento inválidos."},{status:400});
  const amount=parsed.data.amount;const description=parsed.data.description.trim();const date=parsed.data.occurred_on;
  if(parsed.data.isReceipt){const cutoff=new Date(Date.now()-10*60000).toISOString();const {data:recent,error}=await s.from("viva_transactions").select("id,description").eq("user_id",user.id).eq("amount",amount).eq("occurred_on",date).gte("created_at",cutoff).limit(50);if(error)throw error;if((recent||[]).some(row=>normalize(row.description)===normalize(description)))return NextResponse.json({duplicate:true,error:"Este comprovante parece já ter sido registrado nos últimos 10 minutos. Confira o histórico antes de salvar novamente."},{status:409})}
  let receiptPath:string|null=null;let uploadRow:{id:string;temp_path:string;mime_type:string}|null=null;let admin:ReturnType<typeof createAdminClient>|null=null;
  if(parsed.data.receiptUploadId){admin=createAdminClient();const {data:upload,error}=await admin.from("viva_receipt_uploads").select("id,temp_path,mime_type").eq("id",parsed.data.receiptUploadId).eq("user_id",user.id).eq("status","processed").maybeSingle();if(error)throw error;if(!upload)return NextResponse.json({error:"O comprovante temporário expirou. Anexe novamente."},{status:410});uploadRow=upload;const {data:profile,error:profileError}=await admin.from("viva_profiles").select("save_receipts").eq("id",user.id).maybeSingle();if(profileError)throw profileError;if(profile?.save_receipts){const {data:file,error:fileError}=await admin.storage.from("viva-receipt-temp").download(upload.temp_path);if(fileError||!file)throw new Error("Não consegui recuperar o comprovante para guardar.");const extension=upload.mime_type==="application/pdf"?"pdf":upload.mime_type==="image/png"?"png":upload.mime_type==="image/webp"?"webp":"jpg";receiptPath=user.id+"/"+crypto.randomUUID()+"."+extension;const {error:storeError}=await admin.storage.from("viva-receipts").upload(receiptPath,file,{contentType:upload.mime_type,upsert:false});if(storeError)throw storeError}}
  let row;try{row=await createTransaction(s,user.id,{...parsed.data,receipt_path:receiptPath})}catch(error){if(receiptPath&&admin)await admin.storage.from("viva-receipts").remove([receiptPath]);throw error}
  if(uploadRow&&admin){await admin.storage.from("viva-receipt-temp").remove([uploadRow.temp_path]);await admin.from("viva_receipt_uploads").update({status:receiptPath?"saved":"discarded",receipt_path:receiptPath,expires_at:new Date().toISOString()}).eq("id",uploadRow.id).eq("user_id",user.id)}
  return NextResponse.json({transaction:row,message:receiptPath?"Lançamento salvo com sucesso. Comprovante guardado.":"Lançamento salvo com sucesso."});
 }catch(e){console.error("VIVA transaction create failed",e);return NextResponse.json({error:e instanceof Error?e.message:"Não foi possível salvar."},{status:400})}
}

import {createCipheriv,createECDH,createHmac,createPrivateKey,createSign,randomBytes} from "node:crypto";
type Subscription={endpoint:string;p256dh:string;auth_key:string};
const b64url=(value:Buffer|string)=>Buffer.from(value).toString("base64url");
function hkdf(secret:Buffer,salt:Buffer,info:Buffer,length:number){
 const prk=createHmac("sha256",salt).update(secret).digest();let output=Buffer.alloc(0);let previous=Buffer.alloc(0);let counter=1;
 while(output.length<length){previous=createHmac("sha256",prk).update(Buffer.concat([previous,info,Buffer.from([counter++])])).digest();output=Buffer.concat([output,previous])}
 return output.subarray(0,length);
}
function vapidToken(endpoint:string){
 const publicKey=process.env.VAPID_PUBLIC_KEY||"";const privateKey=process.env.VAPID_PRIVATE_KEY||"";const subject=process.env.VAPID_SUBJECT||"https://viva-plus-fundacao-mvp-1.vercel.app";
 if(!publicKey||!privateKey)throw new Error("Chaves VAPID não configuradas.");
 const raw=Buffer.from(publicKey,"base64url");if(raw.length!==65||raw[0]!==4)throw new Error("Chave pública VAPID inválida.");
 const jwk={kty:"EC",crv:"P-256",x:b64url(raw.subarray(1,33)),y:b64url(raw.subarray(33,65)),d:privateKey};
 const key=createPrivateKey({key:jwk,format:"jwk"});
 const header=b64url(JSON.stringify({typ:"JWT",alg:"ES256"}));
 const payload=b64url(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+12*60*60,sub:subject}));
 const input=header+"."+payload;const signer=createSign("SHA256");signer.update(input);signer.end();
 const signature=signer.sign({key,dsaEncoding:"ieee-p1363"});
 return input+"."+b64url(signature);
}
export async function sendWebPush(subscription:Subscription,payload:Record<string,unknown>){
 const receiver=Buffer.from(subscription.p256dh,"base64url");const auth=Buffer.from(subscription.auth_key,"base64url");
 if(receiver.length!==65||auth.length!==16)throw new Error("Chaves da inscrição push inválidas.");
 const ecdh=createECDH("prime256v1");ecdh.generateKeys();const senderPublic=ecdh.getPublicKey();const shared=ecdh.computeSecret(receiver);
 const info=Buffer.concat([Buffer.from("WebPush: info\0"),receiver,senderPublic]);
 const ikm=hkdf(auth,shared,info,32);const salt=randomBytes(16);
 const cek=hkdf(ikm,salt,Buffer.from("Content-Encoding: aes128gcm\0"),16);
 const nonce=hkdf(ikm,salt,Buffer.from("Content-Encoding: nonce\0"),12);
 const plain=Buffer.concat([Buffer.from(JSON.stringify(payload)),Buffer.from([2])]);
 const cipher=createCipheriv("aes-128-gcm",cek,nonce);const encrypted=Buffer.concat([cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
 const recordSize=Buffer.alloc(4);recordSize.writeUInt32BE(4096,0);
 const body=Buffer.concat([salt,recordSize,Buffer.from([senderPublic.length]),senderPublic,encrypted]);
 const response=await fetch(subscription.endpoint,{method:"POST",headers:{Authorization:"vapid t="+vapidToken(subscription.endpoint)+", k="+(process.env.VAPID_PUBLIC_KEY||""),"Content-Encoding":"aes128gcm","Content-Type":"application/octet-stream","TTL":"86400","Urgency":payload.type==="agenda"?"high":"normal"},body:body as unknown as BodyInit});
 if(!response.ok){const detail=(await response.text().catch(()=>"")).slice(0,240);throw new Error("Push HTTP "+response.status+(detail?": "+detail:""))}
 return response.status;
}

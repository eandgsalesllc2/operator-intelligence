import {authenticate,startSession} from "@/lib/auth";

export const runtime="nodejs";
export async function POST(req:Request){
 try{
  const b=await req.json().catch(()=>({}));
  const email=String(b.email??"").slice(0,254),password=String(b.password??"").slice(0,500);
  if(!email||!password)return Response.json({error:"Enter your email and password."},{status:400});
  const r=await authenticate(email,password);
  if(!r.user)return Response.json({error:r.error},{status:401});
  await startSession(r.user);
  return Response.json({user:r.user});
 }catch{return Response.json({error:"Sign-in failed. Please try again."},{status:500})}
}

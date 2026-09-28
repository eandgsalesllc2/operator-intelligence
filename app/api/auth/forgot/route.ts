import {createResetToken,findUserByEmail,sendResetEmail} from "@/lib/auth";

export const runtime="nodejs";
// Always answers the same way, so it can't be used to discover which emails have accounts.
export async function POST(req:Request){
 const b=await req.json().catch(()=>({}));const email=String(b.email||"").trim().toLowerCase().slice(0,254);
 const generic={ok:true,message:"If that email has an approved account, a reset is on its way. No email after a few minutes? Ask your BrandTracer admin for a reset link."};
 if(!email)return Response.json(generic);
 try{
  const u=await findUserByEmail(email);
  if(u&&u.status==="approved"){const token=await createResetToken(u.id);const origin=new URL(req.url).origin;await sendResetEmail(u.email,`${origin}/reset?token=${token}`).catch(()=>false)}
 }catch{}
 return Response.json(generic);
}

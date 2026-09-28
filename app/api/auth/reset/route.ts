import {passwordProblem,resetPassword} from "@/lib/auth";

export const runtime="nodejs";
export async function POST(req:Request){
 const b=await req.json().catch(()=>({}));const token=String(b.token||""),password=String(b.password||"");
 if(!token)return Response.json({error:"This reset link is incomplete."},{status:400});
 const weak=passwordProblem(password);if(weak)return Response.json({error:weak},{status:400});
 if(b.invite&&b.acceptTerms!==true)return Response.json({error:"Please accept the research rules to continue."},{status:400});
 const r=await resetPassword(token,password,b.acceptTerms===true);
 return r.ok?Response.json({ok:true}):Response.json({error:r.error},{status:400});
}

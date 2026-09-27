import {currentSession,markOnboarded} from "@/lib/auth";

export const runtime="nodejs";
// POST {done:true} when the guide is finished; {done:false} to show it again on next load.
export async function POST(req:Request){
 const s=await currentSession();
 if(!s)return Response.json({error:"Sign in first."},{status:401});
 const b=await req.json().catch(()=>({}));
 await markOnboarded(s.uid,b.done!==false);
 return Response.json({ok:true});
}

import {currentUser} from "@/lib/auth";
import {checkInvestigation,lastSnapshot} from "@/lib/watch";

export const runtime="nodejs";
export const maxDuration=120;
// POST {investigationId} → re-check a brand now (BrandSearch + Atria). At most once an hour per brand.
export async function POST(req:Request){
 const me=await currentUser();if(me&&me.status!=="approved")return Response.json({error:"Your account isn't approved."},{status:403}); // no user = a script token already checked by middleware
 const b=await req.json().catch(()=>({}));const id=String(b.investigationId||"");if(!id)return Response.json({error:"investigationId is required"},{status:400});
 const last=await lastSnapshot(id);
 if(last&&Date.now()-new Date(last.taken_at).getTime()<60*60e3)return Response.json({error:`Checked ${Math.round((Date.now()-new Date(last.taken_at).getTime())/6e4)} minutes ago — try again in an hour.`},{status:429});
 const r=await checkInvestigation(id);
 return r.checked?Response.json(r):Response.json({error:r.note||"Check failed"},{status:404});
}

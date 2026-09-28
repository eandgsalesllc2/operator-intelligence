import {currentUser,isAdmin} from "@/lib/auth";
import {applyChannelScans} from "@/lib/repository";

export const runtime="nodejs";
export const maxDuration=300;
// POST {updates:[{id, scan}]} → store storefront channel scans. Admins, or a script token (no user session).
export async function POST(req:Request){
 const me=await currentUser();if(me&&!isAdmin(me))return Response.json({error:"Admins only."},{status:403});
 const b=await req.json().catch(()=>({}));const updates=Array.isArray(b.updates)?b.updates.filter((u:any)=>u?.id&&u?.scan&&Array.isArray(u.scan.signals)).slice(0,400):[];
 if(!updates.length)return Response.json({error:"No updates"},{status:400});
 try{return Response.json(await applyChannelScans(updates))}catch(e){return Response.json({error:e instanceof Error?e.message:"Update failed"},{status:500})}
}

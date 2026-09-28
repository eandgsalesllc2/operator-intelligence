import {currentUser} from "@/lib/auth";
import {changesFor,lastChecked,setWatched,watchedIds} from "@/lib/watch";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const need=()=>Response.json({error:"Sign in to use your watchlist."},{status:401});

// GET → your watched brands, when each was last checked, and changes on them (newest first) with an unread count.
export async function GET(){
 const me=await currentUser();if(!me)return need();
 const items=await watchedIds(me.id);const ids=items.map(i=>i.investigation_id);
 const [changes,checked]=await Promise.all([changesFor(ids),lastChecked(ids)]);
 const seen=me.watch_seen_at?new Date(me.watch_seen_at).getTime():0;
 return Response.json({items:items.map(i=>({...i,lastChecked:checked[i.investigation_id]||null})),changes,unread:changes.filter((c:any)=>new Date(c.detected_at).getTime()>seen).length,seenAt:me.watch_seen_at||null,weeklyScheduled:Boolean(process.env.CRON_SECRET)});
}
// POST {investigationId, watch} → star / unstar
export async function POST(req:Request){
 const me=await currentUser();if(!me)return need();
 const b=await req.json().catch(()=>({}));const id=String(b.investigationId||"");if(!id)return Response.json({error:"investigationId is required"},{status:400});
 await setWatched(me.id,id,b.watch!==false);
 return Response.json({ok:true,watching:b.watch!==false});
}

import {currentUser} from "@/lib/auth";
import {markSeen} from "@/lib/watch";

export const runtime="nodejs";
export async function POST(){const me=await currentUser();if(!me)return Response.json({error:"Sign in first."},{status:401});await markSeen(me.id);return Response.json({ok:true})}

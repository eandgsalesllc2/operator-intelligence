import {retagAll} from "@/lib/repository";

export const dynamic="force-dynamic";
export const maxDuration=120;
// POST: recompute every investigation's filter tags from its stored profile, marketing and metrics.
export async function POST(){
 try{return Response.json(await retagAll())}
 catch(e){return Response.json({error:e instanceof Error?e.message:"Retag failed"},{status:500})}
}

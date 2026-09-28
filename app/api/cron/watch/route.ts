import {runDueChecks} from "@/lib/watch";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
// Vercel Cron (daily) → re-checks watched brands not checked in the last week. Middleware only lets this through
// with "Authorization: Bearer <CRON_SECRET>", which Vercel sends automatically once CRON_SECRET is set.
export async function GET(){
 try{return Response.json(await runDueChecks())}
 catch(e){return Response.json({error:e instanceof Error?e.message:"Watch run failed"},{status:500})}
}

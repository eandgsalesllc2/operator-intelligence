import {NextRequest} from "next/server";
import {changesFor,lastSnapshot} from "@/lib/watch";

export const dynamic="force-dynamic";
// GET ?investigationId= → recent watchlist changes for one brand and when it was last checked.
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get("investigationId");if(!id)return Response.json({error:"investigationId is required"},{status:400});
 const [changes,last]=await Promise.all([changesFor([id],20),lastSnapshot(id)]);
 return Response.json({changes,lastChecked:last?.taken_at||null});
}

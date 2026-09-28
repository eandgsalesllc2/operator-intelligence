import {NextRequest} from "next/server";
import {searchAll} from "@/lib/repository";

export const dynamic="force-dynamic";
// GET ?q= → brands, graph entities (people, companies, trademarks…) and identifiers (pixels, stores, phones…) that match.
export async function GET(req:NextRequest){
 try{return Response.json({hits:await searchAll(req.nextUrl.searchParams.get("q")||"")})}
 catch(e){return Response.json({hits:[],error:e instanceof Error?e.message:"Search failed"},{status:500})}
}

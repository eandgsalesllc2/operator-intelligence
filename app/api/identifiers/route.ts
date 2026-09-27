import {NextRequest} from "next/server";
import {getInvestigation,matchIdentifiers} from "@/lib/repository";
import {identifierRows} from "@/lib/profile";

export const dynamic="force-dynamic";

// GET ?investigationId=… → every other investigation sharing one of its identifiers.
// GET ?value=…&kind=… → investigations carrying that single identifier.
export async function GET(req:NextRequest){
 try{
  const id=req.nextUrl.searchParams.get("investigationId");
  if(id){
   const c=await getInvestigation(id);
   if(!c)return Response.json({error:"Investigation not found"},{status:404});
   const rows=identifierRows(c.profile,c.marketing,c.domain);
   const matches=await matchIdentifiers(rows.map(r=>r.normalized),id);
   return Response.json({identifiers:rows,matches});
  }
  const value=req.nextUrl.searchParams.get("value");const kind=req.nextUrl.searchParams.get("kind")||"tracking";
  if(!value)return Response.json({error:"investigationId or value is required"},{status:400});
  const rows=identifierRows({identifiers:{otherTracking:[value]}});const n=identifierRows({identifiers:{supportEmails:kind==="email"?[value]:[],phones:kind==="phone"?[value]:[]}});
  return Response.json({matches:await matchIdentifiers([...rows,...n].map(r=>r.normalized))});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Lookup failed"},{status:500})}
}

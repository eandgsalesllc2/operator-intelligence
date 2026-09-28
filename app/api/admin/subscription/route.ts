import {currentUser,isAdmin} from "@/lib/auth";
import {setSubscriptionOverride} from "@/lib/repository";

export const runtime="nodejs";
// POST {id, value:"on"|"off"|null, note?} → manual subscription call that automatic checks won't undo.
export async function POST(req:Request){
 const me=await currentUser();if(me&&!isAdmin(me))return Response.json({error:"Admins only."},{status:403});
 const b=await req.json().catch(()=>({}));
 const value=b.value==="on"||b.value==="off"?b.value:null;
 const r=await setSubscriptionOverride(String(b.id||""),value,b.note?String(b.note).slice(0,200):undefined);
 return r?Response.json(r):Response.json({error:"Investigation not found"},{status:404});
}

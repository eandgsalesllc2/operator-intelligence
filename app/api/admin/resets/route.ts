import {createResetToken,currentUser,isAdmin,listUsers} from "@/lib/auth";

export const runtime="nodejs";
// POST {userId} → a fresh one-hour reset link for that user, shown once to the admin to pass on.
export async function POST(req:Request){
 const me=await currentUser();if(!isAdmin(me))return Response.json({error:"Admins only."},{status:403});
 const b=await req.json().catch(()=>({}));const u=(await listUsers()).find(x=>x.id===String(b.userId||""));
 if(!u||u.status!=="approved")return Response.json({error:"Only approved accounts can reset a password."},{status:400});
 const token=await createResetToken(u.id);
 return Response.json({link:`${new URL(req.url).origin}/reset?token=${token}`,expiresInMinutes:60});
}

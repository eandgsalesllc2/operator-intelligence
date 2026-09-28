import {redirect} from "next/navigation";
import AdminPanel from "@/components/AdminPanel";
import {currentUser,isAdmin} from "@/lib/auth";

export const metadata={title:"Admin · BrandTracer"};
export const dynamic="force-dynamic";
export default async function Admin(){
 const me=await currentUser();
 if(!isAdmin(me))redirect("/");
 return <AdminPanel/>;
}

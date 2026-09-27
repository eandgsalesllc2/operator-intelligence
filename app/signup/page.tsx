import {redirect} from "next/navigation";
import AuthScreen from "@/components/AuthScreen";
import {currentSession} from "@/lib/auth";

export const metadata={title:"Create account · Operator Intelligence"};
export default async function Signup({searchParams}:{searchParams:Promise<{next?:string}>}){
 if(await currentSession())redirect("/");
 return <AuthScreen mode="signup" next={(await searchParams).next}/>;
}

import {redirect} from "next/navigation";
import AuthScreen from "@/components/AuthScreen";
import {currentSession} from "@/lib/auth";

export const metadata={title:"Sign in · BrandTracer"};
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}){
 if(await currentSession())redirect("/");
 return <AuthScreen mode="login" next={(await searchParams).next}/>;
}

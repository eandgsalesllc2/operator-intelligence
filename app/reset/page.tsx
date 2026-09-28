import AuthScreen from "@/components/AuthScreen";

export const metadata={title:"New password · BrandTracer"};
export default async function Reset({searchParams}:{searchParams:Promise<{token?:string;invite?:string}>}){const p=await searchParams;return <AuthScreen mode="reset" token={p.token||""} invite={p.invite==="1"}/>}

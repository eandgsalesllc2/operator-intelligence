import AuthScreen from "@/components/AuthScreen";

export const metadata={title:"New password · BrandTracer"};
export default async function Reset({searchParams}:{searchParams:Promise<{token?:string}>}){return <AuthScreen mode="reset" token={(await searchParams).token||""}/>}

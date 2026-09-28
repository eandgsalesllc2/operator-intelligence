import {NextResponse,type NextRequest} from "next/server";
import {SESSION_COOKIE,sha256Hex,verifySession} from "@/lib/session";

// Everything requires a signed-in user, except the sign-in/sign-up pages and their API routes.
// Scripts may call the API with "Authorization: Bearer oi_…" tokens stored (hashed) in oi_api_tokens.
const PUBLIC=[/^\/login$/,/^\/signup$/,/^\/forgot$/,/^\/reset$/,/^\/api\/auth\/(login|signup|logout|forgot|reset)$/];

async function validApiToken(req:NextRequest){
 const h=req.headers.get("authorization")||"";
 const m=/^Bearer (oi_[A-Za-z0-9_-]{20,})$/.exec(h);
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!m||!url||!key)return false;
 const r=await fetch(`${url}/rest/v1/oi_api_tokens?token_hash=eq.${await sha256Hex(m[1])}&revoked_at=is.null&select=id&limit=1`,{headers:{apikey:key,Authorization:"Bearer "+key},cache:"no-store"}).catch(()=>null);
 return !!r?.ok&&((await r.json()) as unknown[]).length>0;
}

export async function middleware(req:NextRequest){
 const {pathname,search}=req.nextUrl;
 if(PUBLIC.some(r=>r.test(pathname)))return NextResponse.next();
 const session=await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
 if(session)return NextResponse.next();
 const isApi=pathname.startsWith("/api/");
 if(isApi&&await validApiToken(req))return NextResponse.next();
 if(isApi)return NextResponse.json({error:"Sign in to use BrandTracer."},{status:401});
 const to=new URL("/login",req.url);
 if(pathname!=="/")to.searchParams.set("next",pathname+search);
 return NextResponse.redirect(to);
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon|apple-icon.png|apple-icon|robots.txt).*)"]};

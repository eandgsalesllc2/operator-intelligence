import {lookup} from "node:dns/promises";
import {isIP} from "node:net";

// Outbound fetches for research go through here. Hostnames are resolved and every
// address is checked before connecting, and redirects are followed manually so each
// hop is re-validated (Vercel's network is not relied on for SSRF protection).

const BLOCKED_HOSTS=/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|metadata\.google\.internal)$/i;

function privateV4(ip:string){
 const [a,b]=ip.split(".").map(Number);
 return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0)||(a===198&&(b===18||b===19))||a>=224;
}
function privateV6(ip:string){
 const v=ip.toLowerCase();
 if(v==="::"||v==="::1")return true;
 if(v.startsWith("::ffff:"))return privateV4(v.slice(7));
 return v.startsWith("fc")||v.startsWith("fd")||v.startsWith("fe8")||v.startsWith("fe9")||v.startsWith("fea")||v.startsWith("feb")||v.startsWith("ff");
}

export function cleanDomain(value:string){
 return value.trim().toLowerCase().replace(/^[a-z]+:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].replace(/:\d+$/,"").replace(/\.$/,"");
}

export function isPublicHostname(host:string){
 if(!host||host.length>253||BLOCKED_HOSTS.test(host)||isIP(host))return false;
 return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host);
}

async function assertSafeUrl(raw:string){
 let url:URL;
 try{url=new URL(raw)}catch{throw new Error("Invalid URL")}
 if(url.protocol!=="https:"&&url.protocol!=="http:")throw new Error("Unsupported scheme");
 if(url.username||url.password)throw new Error("URL credentials are not allowed");
 if(url.port&&!["80","443"].includes(url.port))throw new Error("Port not allowed");
 const host=url.hostname.replace(/^\[|\]$/g,"");
 if(!isPublicHostname(host))throw new Error("Host not allowed: "+host);
 const addrs=await lookup(host,{all:true});
 if(!addrs.length)throw new Error("Host did not resolve");
 for(const a of addrs){if(a.family===4?privateV4(a.address):privateV6(a.address))throw new Error("Host resolves to a private address")}
 return url;
}

export type SafeResponse={url:string;status:number;contentType:string;body:string};

export async function safeFetch(raw:string,opts:{timeoutMs?:number;maxBytes?:number;accept?:string}={}):Promise<SafeResponse>{
 const timeoutMs=opts.timeoutMs??8000, maxBytes=opts.maxBytes??600_000;
 let current=raw;
 for(let hop=0;hop<5;hop++){
  const url=await assertSafeUrl(current);
  const res=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(timeoutMs),headers:{"User-Agent":"Mozilla/5.0 (compatible; OperatorIntelligence/1.0; +research)","Accept":opts.accept||"text/html,application/json;q=0.9,*/*;q=0.5"}});
  if(res.status>=300&&res.status<400&&res.headers.get("location")){current=new URL(res.headers.get("location")!,url).toString();continue}
  const reader=res.body?.getReader();let received=0;const chunks:Uint8Array[]=[];
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;received+=value.length;chunks.push(value);if(received>=maxBytes){await reader.cancel();break}}}
  const body=Buffer.concat(chunks).toString("utf8");
  return {url:url.toString(),status:res.status,contentType:res.headers.get("content-type")||"",body};
 }
 throw new Error("Too many redirects");
}

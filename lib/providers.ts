import {NodeType} from "./types";

export type ProviderFinding={
 title:string;
 url:string;
 publisher:string;
 snippet:string;
 sourceType:"first_party"|"registry"|"trademark"|"web";
 entities:Array<{type:NodeType;label:string;subtitle:string}>;
 claims:Array<{from?:string;to?:string;label:string;claim:string}>;
};

export interface ResearchProvider{
 name:string;
 supports(seedType:NodeType):boolean;
 search(seedValue:string,seedType:NodeType):Promise<ProviderFinding[]>;
}

const cleanDomain=(value:string)=>value.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0];

const textFromHtml=(html:string)=>html
 .replace(/<script[^>]*>[\s\S]*?<\/script>/gi," ")
 .replace(/<style[^>]*>[\s\S]*?<\/style>/gi," ")
 .replace(/<[^>]+>/g," ")
 .replace(/&nbsp;/gi," ")
 .replace(/&amp;/gi,"&")
 .replace(/&#39;/g,"'")
 .replace(/&quot;/gi,'"')
 .replace(/\s+/g," ")
 .trim();

class FirstPartyProvider implements ResearchProvider{
 name="first_party";
 supports(seedType:NodeType){return seedType==="domain";}
 async search(seedValue:string){
  const domain=cleanDomain(seedValue);
  if(!domain.includes("."))return [];
  const paths=["/","/pages/terms","/pages/terms-of-service","/pages/privacy-policy","/policies/terms-of-service","/policies/privacy-policy"];
  const seen=new Set<string>();
  const findings:ProviderFinding[]=[];
  for(const path of paths){
   const url="https://"+domain+path;
   try{
    const response=await fetch(url,{redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 OperatorIntelligence/1.0"},signal:AbortSignal.timeout(7000)});
    if(!response.ok)continue;
    const finalUrl=response.url||url;
    if(seen.has(finalUrl))continue;
    const type=response.headers.get("content-type")||"";
    if(!type.includes("text/html"))continue;
    const text=textFromHtml((await response.text()).slice(0,300000));
    if(text.length<40)continue;
    seen.add(finalUrl);
    findings.push({
     title:path==="/"?domain:path.includes("privacy")?"Privacy Policy":"Terms / Legal",
     url:finalUrl,
     publisher:domain,
     snippet:text.slice(0,4000),
     sourceType:"first_party",
     entities:[{type:"domain",label:domain,subtitle:"First-party website"}],
     claims:[]
    });
   }catch{}
  }
  return findings;
 }
}

export const providers:ResearchProvider[]=[new FirstPartyProvider()];
export const providerNames=["first_party","search","trademark","registry"] as const;

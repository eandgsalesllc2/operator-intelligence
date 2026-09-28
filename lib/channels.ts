// Marketing channels a brand is set up for, read from the public storefront: ad pixels, conversion tags and
// email/SMS/affiliate/influencer/TV/podcast vendors in the homepage HTML (including Shopify's web-pixel config)
// and in any Google Tag Manager containers it loads. A tag shows the brand tracks that channel — it is not proof
// of current spend. Seen ads (BrandSearch/Atria) are what show a channel is actually running.
import {safeFetch} from "./net";
import {SIGNATURES,type ChannelGroup,type ChannelScan,type ChannelSignal} from "./channel-signatures";
export type {ChannelGroup,ChannelScan,ChannelSignal};

function scan(text:string,where:"site"|"gtm",out:Map<string,ChannelSignal>){
 for(const [channel,,vendor,re] of SIGNATURES)if(re.test(text)&&!out.has(vendor))out.set(vendor,{channel,vendor,where});
}

export async function detectChannels(domain:string):Promise<ChannelScan|null>{
 const host=domain.toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0];if(!host)return null;
 const get=async(url:string)=>{try{const r=await safeFetch(url,{timeoutMs:10000,maxBytes:3_000_000});return r.status===200?r.body:null}catch{return null}};
 const pages:string[]=[];const out=new Map<string,ChannelSignal>();let html="";
 for(const u of [`https://${host}/`,`https://www.${host}/`]){const b=await get(u);if(b){html=b;pages.push(u);break}}
 if(!html)return null;
 // A product page often loads checkout/conversion tags the homepage doesn't.
 const prod=/href="(\/products\/[a-z0-9-]+)"/i.exec(html)?.[1];
 if(prod){const b=await get(`https://${host}${prod}`);if(b){html+="\n"+b;pages.push(`https://${host}${prod}`)}}
 scan(html,"site",out);
 // Only the container's configured tags count — the GTM runtime itself mentions many vendor URLs.
 const gtm=[...new Set([...html.matchAll(/GTM-[A-Z0-9]{4,9}/g)].map(m=>m[0]))].slice(0,3);
 await Promise.all(gtm.map(async id=>{const js=await get(`https://www.googletagmanager.com/gtm.js?id=${id}`);if(js){const a=js.indexOf('"resource"'),b=js.indexOf('"runtime"',a);if(a>=0)scan(js.slice(a,b>a?b:undefined),"gtm",out)}}));
 return {checkedAt:new Date().toISOString(),pages,gtm,signals:[...out.values()]};
}

// Shopify selling plans (subscriptions) straight from the store's public product data: /products.json lists
// products and /products/<handle>.js carries each product's selling_plan_groups. This is the ground truth for
// "does this brand sell on subscription", independent of which subscription app it uses.
import {safeFetch} from "./net";

export type SellingPlans={checkedAt:string;productsChecked:number;productsWithPlans:number;subscriptionOnly:number;groups:{name:string;appId?:string|number|null;plans:string[]}[]};

export async function detectSellingPlans(domain:string):Promise<SellingPlans|null>{
 const host=domain.toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0];if(!host)return null;
 const json=async(url:string)=>{const r=await safeFetch(url,{timeoutMs:9000,maxBytes:2_000_000,accept:"application/json"});if(r.status!==200)throw new Error(String(r.status));return JSON.parse(r.body)};
 let products:any[]=[];
 try{products=(await json(`https://${host}/products.json?limit=30`)).products||[]}catch{return null} // not Shopify, or blocked
 const handles=(products.filter(p=>!/gift|card|sample|sticker|merch/i.test(p.handle)).map(p=>p.handle) as string[]).slice(0,8);
 const groups=new Map<string,{name:string;appId?:string|number|null;plans:Set<string>}>();let checked=0,withPlans=0,only=0;
 await Promise.all(handles.map(async h=>{
  try{const p=await json(`https://${host}/products/${encodeURIComponent(h)}.js`);checked++;
   const gs=(p.selling_plan_groups||[]) as any[];if(gs.length)withPlans++;if(p.requires_selling_plan)only++;
   for(const g of gs){const k=String(g.name||"plan");const e=groups.get(k)||{name:k,appId:g.app_id??null,plans:new Set<string>()};for(const s of g.selling_plans||[])if(s?.name)e.plans.add(String(s.name));groups.set(k,e)}
  }catch{}
 }));
 if(!checked)return null;
 return {checkedAt:new Date().toISOString(),productsChecked:checked,productsWithPlans:withPlans,subscriptionOnly:only,groups:[...groups.values()].map(g=>({name:g.name,appId:g.appId,plans:[...g.plans].slice(0,6)}))};
}

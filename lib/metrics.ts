// Brand traffic and a transparent revenue forecast.
// Visits, ad counts and bestseller prices come from BrandSearch; revenue is a model, not a reported figure:
//   AOV = median price of the top-5 bestsellers by rank, ignoring items under $5
//   conversion is halved when AOV > $150 (high-ticket items)
//   low  = visits × 1.0% × AOV
//   mid  = visits × 2.0% × AOV × 1.3   (bundles / upsells)
//   high = visits × 3.0% × AOV × 1.6
export type Metrics={
 monthlyVisits?:number|null;
 revenue?:{low:number;mid:number;high:number}|null;
 aov?:number|null;
 currency?:string;
 metaActiveAds?:number|null;
 metaTotalAds?:number|null;
 productCount?:number|null;
 bestsellers?:{title:string;price:number}[];
 source?:string;
 sourceUrl?:string;
 asOf?:string;
 method?:string;
 // Subscription-focused brands: MRR = forecast monthly revenue × assumed subscription take rate.
 subscription?:{focused:boolean;signals?:string[];takeRate?:number;mrr?:{low:number;mid:number;high:number}|null}|null;
};
export const REVENUE_METHOD="Forecast, not reported revenue: monthly visits × conversion (1% / 2% / 3%, halved when the order value is over $150) × average order value (median price of the top-5 bestsellers by rank, ignoring items under $5; ×1 / ×1.3 / ×1.6 for bundles and upsells).";

export const MRR_METHOD="Estimated MRR, not reported: forecast monthly revenue × 70% assumed subscription take rate. Only shown for brands with a subscription signal (a subscription app such as Recharge, Loop or Skio on the store, or subscribe-and-save offers in their ads).";

export function forecast(visits:number|null|undefined,prices:number[]):{aov:number|null;revenue:Metrics["revenue"]}{
 const p=prices.filter(x=>x>=5).slice(0,5);
 if(!visits||!p.length)return {aov:p.length?median(p):null,revenue:null};
 const aov=median(p);
 const k=aov>150?0.5:1; // high-ticket items convert at about half the rate
 return {aov,revenue:{low:Math.round(visits*0.01*k*aov),mid:Math.round(visits*0.02*k*aov*1.3),high:Math.round(visits*0.03*k*aov*1.6)}};
}
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};

export function compact(n:number|null|undefined,prefix=""){
 if(n===null||n===undefined||!isFinite(n))return "—";
 const a=Math.abs(n);
 const [v,s]=a>=1e9?[n/1e9,"B"]:a>=1e6?[n/1e6,"M"]:a>=1e3?[n/1e3,"K"]:[n,""];
 return prefix+(Math.abs(v)>=100||s===""?Math.round(v).toString():v.toFixed(1).replace(/\.0$/,""))+s;
}

export const currencySymbol=(c?:string)=>({USD:"$",EUR:"€",GBP:"£",CAD:"CA$",AUD:"A$"} as Record<string,string>)[c||"USD"]||((c||"")+" ");

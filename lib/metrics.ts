// Brand traffic and a transparent revenue forecast.
// Visits, ad counts and bestseller prices come from BrandSearch; revenue is a model, not a reported figure:
//   AOV = median price of the top-5 bestsellers
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
};
export const REVENUE_METHOD="Forecast, not reported revenue: monthly visits × conversion (1% / 2% / 3%) × average order value (median of top-5 bestseller prices, ×1 / ×1.3 / ×1.6 for bundles and upsells).";

export function forecast(visits:number|null|undefined,prices:number[]):{aov:number|null;revenue:Metrics["revenue"]}{
 const p=prices.filter(x=>x>0).slice(0,5).sort((a,b)=>a-b);
 if(!visits||!p.length)return {aov:p.length?median(p):null,revenue:null};
 const aov=median(p);
 return {aov,revenue:{low:Math.round(visits*0.01*aov),mid:Math.round(visits*0.02*aov*1.3),high:Math.round(visits*0.03*aov*1.6)}};
}
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2};

export function compact(n:number|null|undefined,prefix=""){
 if(n===null||n===undefined||!isFinite(n))return "—";
 const a=Math.abs(n);
 const [v,s]=a>=1e9?[n/1e9,"B"]:a>=1e6?[n/1e6,"M"]:a>=1e3?[n/1e3,"K"]:[n,""];
 return prefix+(Math.abs(v)>=100||s===""?Math.round(v).toString():v.toFixed(1).replace(/\.0$/,""))+s;
}

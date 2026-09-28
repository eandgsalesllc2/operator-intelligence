"use client";
import {useMemo,useState} from "react";
import {Case} from "@/lib/types";
import {labelOf,verticalOf} from "@/lib/categories";
import {compact,currencySymbol} from "@/lib/metrics";
import {StarButton} from "./Watchlist";
import SiteLink from "./SiteLink";

// Every investigation as a case-file card. Uses the sidebar's category/flag/search filters, adds sorting and quick flags.
const OWN:Record<string,{t:string;tone:string}>={identified:{t:"OWNER IDENTIFIED",tone:"ok"},legal_entity_only:{t:"LEGAL ENTITY ONLY",tone:"warn"},operator_unknown:{t:"OPERATOR UNKNOWN",tone:"bad"},contested:{t:"CONTESTED",tone:"bad"}};
const QUICK=[
 ["all","All","Every brand in this view."],
 ["persona-ads","Persona ads","Brands whose Meta ads run largely through non-brand pages — “doctor”, persona or creator pages carrying 25%+ of active ads, 3+ such pages live, or research flagging fake doctor pages."],
 ["subscription","Subscription","Brands that sell on subscription: recurring Shopify selling plans on the store, a subscription app, or subscribe-and-save ads. These show estimated MRR."],
 ["lawsuit","Lawsuits","At least one lawsuit on record — court cases, class actions, trademark or domain (UDRP) disputes."],
 ["regulatory","Regulatory","Action by a regulator on record — FDA warning letters, FTC or state attorney-general cases, seizures."],
 ["ownership:operator_unknown","Operator unknown","No legal entity or operator identified yet — the store doesn't say who runs it and research hasn't found them."],
 ["network:*","In a network","Brands that share a parent company or operator group with at least one other brand in BrandTracer."],
 ["needs-deep-dive","Needs deep dive","Ownership isn't settled — research left open questions worth a closer look (registries, trademarks, shared IDs)."],
] as const;
const SORTS={visits:"Traffic",revenue:"Est. revenue",ads:"Active ads",name:"Name"} as const;
const caseNo=(id:string)=>{let h=7;for(const ch of id)h=(h*33+ch.charCodeAt(0))>>>0;return String(h%10000).padStart(4,"0")};

export default function Portfolio({cases,total,flag,setFlag,onOpen,watched,onToggleWatch}:{cases:Case[];total:number;flag:string;setFlag:(f:string)=>void;onOpen:(id:string)=>void;watched?:Set<string>;onToggleWatch?:(id:string,on:boolean)=>void}){
 const [sort,setSort]=useState<keyof typeof SORTS>("visits");
 const list=useMemo(()=>[...cases].sort((a,b)=>{
  if(sort==="name")return a.name.localeCompare(b.name);
  const v=(x:Case)=>sort==="revenue"?x.metrics?.revenue?.mid:sort==="ads"?x.metrics?.metaActiveAds:x.metrics?.monthlyVisits;
  return (v(b)||0)-(v(a)||0)||a.name.localeCompare(b.name);
 }),[cases,sort]);
 const totals=useMemo(()=>({visits:cases.reduce((s,x)=>s+(x.metrics?.monthlyVisits||0),0),rev:cases.reduce((s,x)=>s+(x.metrics?.revenue?.mid||0),0)}),[cases]);
 return <div className="portfolio">
  <div className="pfHead">
   <div><div className="pfKicker">CASE FILES</div><h1>{cases.length===total?`${total} brands under investigation`:`${cases.length} of ${total} brands`}</h1><p>{compact(totals.visits)} monthly visits · ~{compact(totals.rev,"$")} est. monthly revenue across this view</p></div>
   <label className="pfSort">Sort by<select value={sort} onChange={e=>setSort(e.target.value as keyof typeof SORTS)}>{Object.entries(SORTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  </div>
  <div className="pfChips" role="group" aria-label="Quick filters">{QUICK.map(([k,v,tip])=><button key={k} aria-pressed={flag===k} className={"tipped"+(flag===k?" on":"")} onClick={()=>setFlag(k)} data-tip={tip} aria-describedby={`tip-${k.replace(/[^a-z]/g,"")}`}>{v}</button>)}</div>
  <div className="sr">{QUICK.map(([k,,tip])=><span key={k} id={`tip-${k.replace(/[^a-z]/g,"")}`}>{tip}</span>)}</div>
  {list.length?<div className="pfGrid">{list.map(x=>{
   const own=(x.tags||[]).find(t=>t.startsWith("ownership:"))?.slice(10);const o=own?OWN[own]:null;const m=x.metrics;const cur=currencySymbol(m?.currency);
   const net=(x.tags||[]).find(t=>t.startsWith("network:"))?.slice(8);
   const flags=[(x.tags||[]).includes("persona-ads")&&"Persona ads",(x.tags||[]).includes("subscription")&&"Subscription",(x.tags||[]).includes("lawsuit")&&"Lawsuit",(x.tags||[]).includes("regulatory")&&"Regulatory",(x.tags||[]).some(t=>/^bbb:[DF]/.test(t))&&"BBB D/F"].filter(Boolean) as string[];
   return <div key={x.id} className="pfWrap">{onToggleWatch&&<StarButton compactMode on={!!watched?.has(x.id)} onClick={()=>onToggleWatch(x.id,!watched?.has(x.id))}/>}<div className="pfCard"><button className="pfHit" onClick={()=>onOpen(x.id)} aria-label={`Open ${x.name}`}/>
    <span className="pfNo">№ {caseNo(x.id)}</span>
    {o&&<span className={"pfStamp "+o.tone}>{o.t}</span>}
    <span className="pfCat">{x.category?`${verticalOf(x.category)} › ${labelOf(x.category)}`:"Uncategorized"}</span>
    <span className="pfName">{x.name}</span>
    {x.domain?<SiteLink className="pfDomain" domain={x.domain}/>:<span className="pfDomain">—</span>}
    <span className="pfNums"><span><small>VISITS</small><b>{m?.monthlyVisits!=null?compact(m.monthlyVisits):"—"}</b></span><span><small>EST. REV</small><b>{m?.revenue?compact(m.revenue.mid,cur):"—"}</b></span><span><small>ADS</small><b>{m?.metaActiveAds!=null?compact(m.metaActiveAds):"—"}</b></span></span>
    {(net||flags.length>0)&&<span className="pfFlags">{net&&<em className="net">{net}</em>}{flags.map(f=><em key={f}>{f}</em>)}</span>}
   </div></div>})}</div>:<p className="pfEmpty">No brands match these filters.</p>}
 </div>;
}

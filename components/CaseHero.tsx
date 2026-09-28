"use client";
import {useEffect,useState} from "react";
import {Case} from "@/lib/types";
import {CATEGORIES,labelOf,verticalOf} from "@/lib/categories";
import {MRR_METHOD,REVENUE_METHOD,compact,currencySymbol} from "@/lib/metrics";
import {KIND_LABEL,STRONG_KINDS} from "@/lib/profile";

// The top of a brand page, styled as a case file: stamp, subject, headline numbers and the key findings.
type Match={investigation_id:string;name:string;kind:string;value:string};
type Finding={tag:string;tone:"ok"|"strong"|"warn"|"lead"|"bad";source:string;title:string;detail?:string;open?:string};

const STAMP:Record<string,{text:string;tone:string}>={identified:{text:"OWNER\nIDENTIFIED",tone:"ok"},legal_entity_only:{text:"LEGAL ENTITY\nONLY",tone:"warn"},operator_unknown:{text:"OPERATOR\nUNKNOWN",tone:"bad"},contested:{text:"OWNERSHIP\nCONTESTED",tone:"bad"}};
const caseNo=(id:string)=>{let h=7;for(const ch of id)h=(h*33+ch.charCodeAt(0))>>>0;return String(h%10000).padStart(4,"0")};

function findings(c:Case,matches:Match[]):Finding[]{
 const out:Finding[]=[];const p=c.profile,m=c.marketing;
 const strong=matches.filter(x=>STRONG_KINDS.has(x.kind)&&x.kind!=="attorney");
 const byCase=new Map<string,Match[]>();for(const x of strong){byCase.set(x.investigation_id,[...(byCase.get(x.investigation_id)||[]),x])}
 for(const [id,xs] of [...byCase.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,2)){
  const kinds=[...new Set(xs.map(x=>(KIND_LABEL[x.kind]||x.kind).toLowerCase()))];
  const hard=xs.some(x=>["company","person","trademark_serial","phone","email","shopify_store","gtm","google_analytics","meta_pixel"].includes(x.kind));
  out.push({tag:hard?"STRONG":"CORRELATION",tone:hard?"strong":"warn",source:"Shared identifiers",title:`Shares ${kinds.slice(0,3).join(", ")} with ${xs[0].name}`,detail:xs.slice(0,2).map(x=>x.value).join(" · "),open:id});
 }
 const parent=p?.entities?.find(e=>e.role==="parent");
 if(parent)out.push({tag:(parent.confidence||"strong").toUpperCase(),tone:parent.confidence==="confirmed"?"ok":"strong",source:"Corporate",title:`Parent company: ${parent.name}`,detail:p?.network?.name&&p.network.name!==parent.name?p.network.name:undefined});
 const persona=(m?.meta?.pages||[]).filter(x=>x.persona&&(x.activeAds||0)>0).sort((a,b)=>(b.activeAds||0)-(a.activeAds||0));
 if(persona.length)out.push({tag:"PERSONA",tone:"warn",source:"Meta ads",title:persona.length>1?`${persona.length} non-brand pages run its ads`:`Ads run through “${persona[0].name}”`,detail:persona.slice(0,2).map(x=>`${x.name} · ${x.activeAds} active`).join(" · ")});
 const pre=(m?.landing?.landingPages||[]).filter(l=>l.kind==="advertorial"||l.kind==="quiz"||(l.kind==="external"&&!/amazon|walmart|target/.test(l.host||""))).sort((a,b)=>(b.activeAds||0)-(a.activeAds||0))[0];
 if(pre)out.push({tag:pre.kind==="quiz"?"QUIZ":"PRESELL",tone:"lead",source:"Landing pages",title:pre.kind==="quiz"?"Quiz funnel in front of the store":"Advertorial presell before the store",detail:`${pre.host}${pre.path} · ${pre.activeAds} ads`});
 const suit=p?.reputation?.lawsuits?.[0];
 if(suit)out.push({tag:"LAWSUIT",tone:"bad",source:suit.court||"Court",title:suit.title,detail:[suit.caseNo,suit.date,suit.status].filter(Boolean).join(" · ")});
 const reg=p?.reputation?.regulatory?.[0];
 if(reg)out.push({tag:"REGULATORY",tone:"bad",source:reg.agency,title:reg.action,detail:reg.date||undefined});
 const bbb=p?.reputation?.bbbRating;
 if(bbb&&/^[DF]/i.test(bbb))out.push({tag:`BBB ${bbb}`,tone:"bad",source:"Better Business Bureau",title:`Rated ${bbb} by the BBB`,detail:p?.reputation?.bbbComplaints!=null?`${p.reputation.bbbComplaints} complaints`:undefined});
 if(m?.dataWarning)out.push({tag:"CHECK DATA",tone:"warn",source:"BrandSearch",title:"Ad data may belong to another company",detail:m.dataWarning});
 if(p?.research?.needsDeepDive)out.push({tag:"LEAD",tone:"lead",source:"Next step",title:"Needs a deep dive",detail:p.research.deepDiveReason||undefined});
 return out.slice(0,4);
}

export default function CaseHero({c,onCategory,onFilterVertical,onOpen}:{c:Case;onCategory:(k:string)=>void;onFilterVertical:(v:string)=>void;onOpen:(id:string)=>void}){
 const [matches,setMatches]=useState<Match[]>([]);
 useEffect(()=>{setMatches([]);if(!c.profile&&!c.marketing)return;let live=true;fetch("/api/identifiers?investigationId="+encodeURIComponent(c.id)).then(r=>r.ok?r.json():null).then(d=>{if(live)setMatches(d?.matches||[])}).catch(()=>{});return()=>{live=false}},[c.id,c.profile,c.marketing]);
 const own=c.profile?.research?.ownershipStatus??(c.tags||[]).find(t=>t.startsWith("ownership:"))?.slice(10);const stamp=own?STAMP[own]:{text:"NOT YET\nASSESSED",tone:"lead"};
 const met=c.metrics;const cur=currencySymbol(met?.currency);
 const summary=(c.summary||"").replace(/^\[[^\]]+\]\s*/,"");
 const confirmed=c.nodes.filter(n=>n.confidence==="confirmed").length,strong=c.nodes.filter(n=>n.confidence==="strong").length;
 const f=findings(c,matches);
 const sub=met?.subscription?.focused&&met.subscription.mrr?met.subscription:null;
 return <section className="dossier" aria-label={`Case file for ${c.name}`}>
  <div className="dossierTab">CASE FILE № {caseNo(c.id)}</div>
  <div className={"stamp "+stamp.tone}>{stamp.text}</div>
  <div className="dossierSubject">
   <span>SUBJECT · </span>{c.category?<button className="subjLink" onClick={()=>onFilterVertical(verticalOf(c.category!))}>{verticalOf(c.category).toUpperCase()}</button>:null}
   <label className="subjCat"><span className="sr">Category</span><select value={c.category||""} onChange={e=>onCategory(e.target.value)}><option value="">Uncategorized</option>{[...new Set(CATEGORIES.map(verticalOf))].map(v=><optgroup key={v} label={v}>{CATEGORIES.filter(k=>verticalOf(k)===v).map(k=><option key={k} value={k}>{labelOf(k)}</option>)}</optgroup>)}</select></label>
  </div>
  <h1 className="dossierName">{c.name}</h1>
  <div className="dossierDomain">{c.domain||"no domain on file"} <span>· {c.status}</span></div>
  {summary&&<p className="dossierSummary">{summary}</p>}
  {met&&(met.monthlyVisits!=null||met.revenue)?<div className="fields">
   <div><small>MONTHLY VISITS</small><b>{compact(met.monthlyVisits)}</b><em title={met.asOf?`As of ${met.asOf}`:undefined}>BrandSearch</em></div>
   <div title={REVENUE_METHOD}><small>EST. REV / MO</small><b>{met.revenue?compact(met.revenue.mid,cur):"—"}</b>{met.revenue&&<em>{compact(met.revenue.low,cur)} – {compact(met.revenue.high,cur)}</em>}</div>
   <div title="Median price of the top-5 bestsellers (items under $5 ignored)"><small>EST. AOV</small><b>{met.aov?compact(met.aov,cur):"—"}</b><em>{met.bestsellers?.length?`${met.bestsellers.length} bestsellers`:""}</em></div>
   {sub?<div title={MRR_METHOD+(sub.signals?.length?` Signals: ${sub.signals.join("; ")}.`:"")}><small>EST. MRR · 70% SUB</small><b>{compact(sub.mrr!.mid,cur)}</b><em>{compact(sub.mrr!.low,cur)} – {compact(sub.mrr!.high,cur)}</em></div>:null}
   <div><small>ACTIVE META ADS</small><b>{met.metaActiveAds!=null?met.metaActiveAds.toLocaleString():"—"}</b><em>{met.metaTotalAds!=null?`${met.metaTotalAds.toLocaleString()} all-time`:""}</em></div>
  </div>:<div className="fields empty"><span>No traffic or revenue on file yet — run research to pull BrandSearch and Atria.</span></div>}
  <div className="ledger">{c.nodes.length} ENTITIES · {c.edges.length} LINKS · <span className="ok">{confirmed} CONFIRMED</span> · <span className="strong">{strong} STRONG</span> · {c.evidence.length} SOURCES</div>
  {f.length>0&&<div className="findings"><div className="findingsHead">KEY FINDINGS</div><div className="cards">{f.map((x,i)=>{const inner=<><div className="cardTop"><span className={"tag "+x.tone}>{x.tag}</span><span className="src">{x.source}</span></div><div className="cardTitle">{x.title}</div>{x.detail&&<div className="cardDetail">{x.detail}</div>}</>;return x.open?<button key={i} className="indexCard" style={{transform:`rotate(${[-0.6,0.5,0.4,-0.4][i%4]}deg)`}} onClick={()=>onOpen(x.open!)}>{inner}</button>:<article key={i} className="indexCard" style={{transform:`rotate(${[-0.6,0.5,0.4,-0.4][i%4]}deg)`}}>{inner}</article>})}</div></div>}
 </section>;
}

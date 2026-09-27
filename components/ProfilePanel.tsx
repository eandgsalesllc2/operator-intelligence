"use client";
import {useEffect,useState} from "react";
import {Case} from "@/lib/types";
import {KIND_LABEL,STRONG_KINDS,normalizeIdentifier} from "@/lib/profile";
import {Link2,AlertTriangle,ShieldCheck,Building2,Tags,MapPin,Search} from "lucide-react";

type Match={investigation_id:string;name:string;domain:string;category:string;kind:string;value:string;normalized:string};
const OWNERSHIP:Record<string,{label:string;tone:string}>={identified:{label:"Owner identified",tone:"ok"},legal_entity_only:{label:"Legal entity only",tone:"warn"},operator_unknown:{label:"Operator unknown",tone:"bad"},contested:{label:"Contested",tone:"warn"}};
const isUrl=(s?:string|null)=>!!s&&/^https?:\/\//.test(s);

function Chips({items}:{items?:(string|null|undefined)[]}){const xs=(items||[]).filter(Boolean) as string[];return xs.length?<div className="chips">{xs.map((x,i)=><span key={i} className="chipTag">{x}</span>)}</div>:<span className="dim">—</span>}

export default function ProfilePanel({c,onOpen}:{c:Case;onOpen:(id:string)=>void}){
 const p=c.profile;const [matches,setMatches]=useState<Match[]|null>(null);
 useEffect(()=>{setMatches(null);if(!p)return;fetch("/api/identifiers?investigationId="+encodeURIComponent(c.id)).then(r=>r.json()).then(d=>setMatches(d.matches||[])).catch(()=>setMatches([]))},[c.id,p]);
 if(!p)return <div className="panel"><div className="emptyPanel">No structured profile yet for this investigation. Profiles are built from the dossier and from research runs.</div></div>;
 const id=p.identifiers||{};const own=p.research?.ownershipStatus;const o=own?OWNERSHIP[own]:null;
 const byValue=new Map<string,Match[]>();for(const m of matches||[]){const k=m.kind+"|"+m.normalized;if(!byValue.has(k))byValue.set(k,[]);byValue.get(k)!.push(m)}
 const strong=(matches||[]).filter(m=>STRONG_KINDS.has(m.kind)&&m.kind!=="attorney");
 const linkedCases=[...new Map(strong.map(m=>[m.investigation_id,m])).values()];
 const idRow=(label:string,vals?:(string|null|undefined)[],kind?:string)=>{const xs=(vals||[]).filter(Boolean) as string[];if(!xs.length)return null;return <div className="kv"><span>{label}</span><div className="chips">{xs.map((v,i)=>{const ms=kind?(byValue.get(kind+"|"+normalizeIdentifier(kind,v))||[]):[];return <span key={i} className={"chipTag mono"+(ms.length?" linked":"")} title={ms.length?`Also on: ${ms.map(m=>m.name).join(", ")}`:undefined}>{v}{ms.length?<b> · {ms.length} other</b>:null}</span>})}</div></div>};
 return <div className="profile">
  <div className="pcards">
   <section className={"pcard own "+(o?.tone||"")}><h4><ShieldCheck size={14}/> Ownership</h4><b>{o?.label||"Not assessed"}</b><p>{p.research?.ownershipNote||""}</p>{p.network?.name||p.network?.parent?<p className="dim">Network: <b>{p.network?.name||p.network?.parent}</b>{p.network?.operatorCountry?` · operator country ${p.network.operatorCountry}`:""}</p>:null}</section>
   <section className="pcard"><h4><Link2 size={14}/> Shared with other investigations</h4>{matches===null?<p className="dim">Checking identifiers…</p>:linkedCases.length?<div className="linked">{linkedCases.slice(0,12).map(m=><button key={m.investigation_id} onClick={()=>onOpen(m.investigation_id)}><b>{m.name}</b><span>{KIND_LABEL[m.kind]||m.kind}: {m.value}</span></button>)}</div>:<p className="dim">No other investigation shares its tracking IDs, accounts, contacts, companies or people.</p>}
    {(matches||[]).some(m=>m.kind==="ad_page")&&<div className="small"><b>Same ad page runs ads for:</b> {[...new Map((matches||[]).filter(m=>m.kind==="ad_page").map(m=>[m.investigation_id,m])).values()].slice(0,10).map((m,i)=><button key={i} className="linkBtn" onClick={()=>onOpen(m.investigation_id)}>{m.name} <span className="dim">({m.value})</span></button>)}<p className="dim small">Correlation only: persona pages shared by two brands are a lead, but creators and publishers are paid by many unrelated brands.</p></div>}
    {(matches||[]).some(m=>m.kind==="attorney")&&<p className="dim small">Same trademark attorney as: {[...new Set((matches||[]).filter(m=>m.kind==="attorney").map(m=>m.name))].slice(0,8).join(", ")} (service provider, not ownership).</p>}</section>
   <section className="pcard"><h4><AlertTriangle size={14}/> Reputation & risk</h4>
    <div className="kv"><span>BBB</span><div>{p.reputation?.bbbRating?<b className={/F|D/.test(p.reputation.bbbRating)?"bad":""}>{p.reputation.bbbRating}</b>:<span className="dim">—</span>}{p.reputation?.bbbComplaints!=null?<span className="dim"> · {p.reputation.bbbComplaints} complaints</span>:null}</div></div>
    <div className="kv"><span>Risks</span><Chips items={p.reputation?.risks}/></div>
    {(p.reputation?.lawsuits||[]).map((l,i)=><p key={i} className="small">⚖ {l.title}{l.court?` · ${l.court}`:""}{l.caseNo?` · ${l.caseNo}`:""}{l.date?` · ${l.date}`:""}{l.status?` · ${l.status}`:""}</p>)}
    {(p.reputation?.regulatory||[]).map((r,i)=><p key={i} className="small">🏛 {r.agency}: {r.action}{r.date?` (${r.date})`:""}</p>)}
   </section>
  </div>

  <section className="psec"><h4><Search size={14}/> Pivot identifiers</h4>
   {idRow("Shopify store",[id.shopifyStore,id.shopifyShopId],"shopify_store")}
   {idRow("Google Tag Manager",id.googleTagManager,"gtm")}{idRow("Google Analytics",id.googleAnalytics,"google_analytics")}{idRow("Google Ads",id.googleAds,"google_ads")}
   {idRow("Meta pixel",id.metaPixel,"meta_pixel")}{idRow("TikTok pixel",id.tiktokPixel,"tiktok_pixel")}{idRow("Clarity",id.clarity,"clarity")}{idRow("Klaviyo",id.klaviyo,"klaviyo")}{idRow("Other tracking",id.otherTracking,"tracking")}
   {idRow("Checkout",[id.checkoutVendor?`${id.checkoutVendor} (vendor)`:null,id.checkoutAccount],"checkout_account")}{idRow("Subscriptions",[id.subscriptionApp])}
   {idRow("Payment IDs",id.paymentIds,"payment_id")}{idRow("Amazon sellers",id.amazonSellers,"amazon_seller")}{idRow("Card descriptors",id.cardDescriptors,"card_descriptor")}
   {idRow("Support emails",id.supportEmails,"email")}{idRow("Phones",id.phones,"phone")}
   {(id.relatedDomains||[]).length>0&&<div className="kv"><span>Related domains</span><div className="chips">{id.relatedDomains!.map((d,i)=><span key={i} className="chipTag mono">{d.domain} <em>{d.relation}{d.confidence?` · ${d.confidence}`:""}</em></span>)}</div></div>}
  </section>

  {(p.entities||[]).length>0&&<section className="psec"><h4><Building2 size={14}/> Companies</h4><div className="tableWrap"><table className="ptable"><thead><tr><th>Company</th><th>Role</th><th>Jurisdiction · file</th><th>Formed</th><th>Status</th><th>Officers</th></tr></thead><tbody>{p.entities!.map((e,i)=><tr key={i}><td><b>{e.name}</b>{e.confidence?<span className="dim small"> · {e.confidence}</span>:null}{isUrl(e.source)?<a className="small" href={e.source!} target="_blank" rel="noopener noreferrer"> source</a>:null}</td><td>{e.role||"—"}</td><td>{[e.jurisdiction,e.fileNumber].filter(Boolean).join(" · ")||"—"}</td><td>{e.formed||"—"}</td><td className={/dissolved|suspended/.test(e.status||"")?"bad":""}>{e.status||"—"}</td><td>{(e.officers||[]).map(o=>`${o.name}${o.role?` (${o.role})`:""}`).join(", ")||"—"}</td></tr>)}</tbody></table></div></section>}

  {(p.trademarks||[]).length>0&&<section className="psec"><h4><Tags size={14}/> Trademarks</h4><div className="tableWrap"><table className="ptable"><thead><tr><th>Mark</th><th>Serial / reg.</th><th>Owner</th><th>Status</th><th>Filed</th><th>Attorney</th></tr></thead><tbody>{p.trademarks!.map((t,i)=><tr key={i}><td><b>{t.mark}</b></td><td className="mono">{[t.serial,t.registration].filter(Boolean).join(" / ")||"—"}</td><td>{t.owner||"—"}</td><td className={/abandon|cancel|suspend|oppos/.test(t.status||"")?"warnTxt":""}>{t.status||"—"}</td><td>{t.filed||"—"}</td><td>{t.attorney||"—"}</td></tr>)}</tbody></table></div></section>}

  {(p.addresses||[]).length>0&&<section className="psec"><h4><MapPin size={14}/> Addresses</h4>{p.addresses!.map((a,i)=><div key={i} className="kv"><span>{(a.kind||"unknown").replace(/_/g," ")}</span><div>{a.address}{a.massAddress?<span className="chipTag warn">mass registered-agent address · not ownership</span>:null}</div></div>)}</section>}

  <section className="psec"><h4>Research quality</h4>
   <div className="kv"><span>Depth</span><div>{p.research?.depth||"—"}{p.research?.researchedAt?` · ${p.research.researchedAt}`:""}</div></div>
   {p.research?.needsDeepDive&&<div className="kv"><span>Needs deep dive</span><div className="warnTxt">{p.research.deepDiveReason||"Yes"}</div></div>}
   <div className="kv"><span>Blocked sources</span><Chips items={p.research?.blocked}/></div>
  </section>
 </div>;
}

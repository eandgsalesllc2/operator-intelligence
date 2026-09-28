"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Check,Search,FolderTree,ShieldCheck,Network,FileText,TrendingUp,Building2,Link2,Megaphone,Route,RefreshCw,Scale,Sparkles} from "lucide-react";

// First-run guide: every user swipes through all cards once. It can be replayed from the account menu.
type Card={icon:React.ReactNode;kicker:string;title:string;body:string;points?:string[];visual:React.ReactNode};

const Chip=({t,c}:{t:string;c:string})=><span className={"obChip "+c}>{t}</span>;

const CARDS:Card[]=[
 {icon:<Sparkles size={18}/>,kicker:"Welcome",title:"Your view behind every DTC brand",
  body:"BrandTracer maps who legally owns, who operates and who is connected to direct-to-consumer brands — with a source behind every link.",
  points:["313+ supplement and beauty brands already mapped","Ownership, sister brands, trademarks and people","Traffic, revenue, ads and live funnels for each brand"],
  visual:<svg viewBox="0 0 260 150" className="obSvg"><g stroke="#816745" strokeWidth="1.5"><line x1="130" y1="75" x2="50" y2="35"/><line x1="130" y1="75" x2="215" y2="30"/><line x1="130" y1="75" x2="55" y2="120"/><line x1="130" y1="75" x2="210" y2="118"/><line x1="215" y1="30" x2="210" y2="118" strokeDasharray="4 4"/></g><circle cx="130" cy="75" r="16" fill="#ce4530"/><circle cx="50" cy="35" r="10" fill="#37c68b"/><circle cx="215" cy="30" r="10" fill="#e9b949"/><circle cx="55" cy="120" r="10" fill="#e0a93f"/><circle cx="210" cy="118" r="10" fill="#37c68b"/></svg>},
 {icon:<Search size={18}/>,kicker:"Step 1 · Search",title:"Search anything, research anything",
  body:"Type a brand, domain, person, company, email or phone in the top search bar. Matches in your investigations appear instantly; pick “Research …” to start a new investigation on it.",
  points:["Research reads the site, trademark and company registries, archives, certificates and the web","It builds the graph, evidence and timeline for you in a few minutes","It links the result to any investigation that shares an identifier"],
  visual:<div className="obMock"><div className="obSearch"><Search size={14}/> Sack Consulting<span className="obCaret"/></div><div className="obRow"><b>Resilia</b><span className="dim">resilia.shop · company match</span></div><div className="obRow"><b>Holior</b><span className="dim">holior.com · company match</span></div><div className="obRow hi"><Sparkles size={13}/> Research “Sack Consulting”</div></div>},
 {icon:<FolderTree size={18}/>,kicker:"Step 2 · Investigations",title:"Every brand, grouped and ranked",
  body:"The left sidebar holds all investigations, grouped by vertical and category — Supplements → Joint health, Beauty → Skincare — and sorted by monthly traffic.",
  points:["Filter by category, or by flags like ownership status, lawsuits, persona ads, subscription brands and ad scale","Each row shows monthly visits and estimated revenue","On mobile, open the sidebar with the menu button"],
  visual:<div className="obMock"><div className="obTree"><b>▾ SUPPLEMENTS</b><span>▸ Vitamins & general wellness <em>35</em></span><span>▾ Metabolic & weight management <em>10</em></span><span className="on">R&nbsp; Resilia <small>9.9M visits · ~$9.2M/mo</small></span><span>K&nbsp; Kind Patches <small>1.7M visits</small></span><b>▸ BEAUTY</b></div></div>},
 {icon:<ShieldCheck size={18}/>,kicker:"Step 3 · Evidence standard",title:"Five labels, used strictly",
  body:"Every entity, link and piece of evidence carries one confidence label. Nothing is called ownership without documents behind it.",
  points:["A registered agent, shared address, vendor or trademark attorney is never proof of ownership","The legend in the top bar is always there as a reminder"],
  visual:<div className="obMock obConf"><div><Chip t="CONFIRMED" c="ok"/><span>Direct documentary proof — a filing, terms page, registry record</span></div><div><Chip t="STRONG" c="blue"/><span>Several independent signals agree</span></div><div><Chip t="CORRELATION" c="warn"/><span>Real overlap that does not prove ownership</span></div><div><Chip t="LEAD" c="dim"/><span>Worth checking next</span></div><div><Chip t="EXCLUDED" c="bad"/><span>Checked and ruled out</span></div></div>},
 {icon:<Network size={18}/>,kicker:"Step 4 · Relationship graph",title:"The map of who connects to whom",
  body:"The graph puts the brand in the centre with its companies, people, trademarks, domains, phones and emails around it. Line style shows confidence.",
  points:["Click any node to see what is known about it","Use “Research this” on a node to expand the map from it","Solid lines are confirmed or strong; dashed lines are correlations or leads"],
  visual:<svg viewBox="0 0 260 150" className="obSvg"><g strokeWidth="1.5"><line x1="130" y1="78" x2="45" y2="40" stroke="#37c68b"/><line x1="130" y1="78" x2="215" y2="40" stroke="#e0a93f"/><line x1="130" y1="78" x2="45" y2="120" stroke="#e9b949" strokeDasharray="5 4"/><line x1="130" y1="78" x2="215" y2="120" stroke="#827b72" strokeDasharray="2 4"/></g><rect x="100" y="64" width="60" height="28" rx="7" fill="#ce4530"/><text x="130" y="82" textAnchor="middle" fontSize="11" fill="#fff">Brand</text><rect x="8" y="28" width="74" height="24" rx="6" fill="#123a2a"/><text x="45" y="44" textAnchor="middle" fontSize="10" fill="#8fe3bd">LLC · owner</text><rect x="178" y="28" width="74" height="24" rx="6" fill="#1c2530"/><text x="215" y="44" textAnchor="middle" fontSize="10" fill="#b2c9e6">Founder</text><rect x="8" y="108" width="74" height="24" rx="6" fill="#3a2e10"/><text x="45" y="124" textAnchor="middle" fontSize="10" fill="#f3d38a">Shared phone</text><rect x="178" y="108" width="74" height="24" rx="6" fill="#2b261f"/><text x="215" y="124" textAnchor="middle" fontSize="10" fill="#b4aca1">Lead domain</text></svg>},
 {icon:<FileText size={18}/>,kicker:"Step 5 · Evidence & timeline",title:"Every claim has a receipt",
  body:"The Evidence tab lists each source — the URL and exactly what it supports. The Timeline tab puts formations, trademark filings, domain registrations, lawsuits and rebrands in date order.",
  points:["Open any source in one click to check it yourself","Use Add evidence to record something you found"],
  visual:<div className="obMock"><div className="obEv"><Chip t="CONFIRMED" c="ok"/><div><b>USPTO serial 99417595</b><span className="dim">Owner: Sack Consulting Inc.</span></div></div><div className="obEv"><Chip t="STRONG" c="blue"/><div><b>Terms of service</b><span className="dim">Names the merchant of record</span></div></div><div className="obTl"><i/>2024-03 · Company formed<i/>2025-01 · Trademark filed<i/>2026-07 · UDRP case won</div></div>},
 {icon:<TrendingUp size={18}/>,kicker:"Step 6 · Traffic & revenue",title:"How big is the brand?",
  body:"Under the summary you'll see monthly visits from BrandSearch and an estimated monthly revenue range, average order value and — for subscription brands — estimated MRR.",
  points:["Revenue = visits × 1–3% conversion × AOV. It's a forecast, not reported revenue","AOV = median price of the top-5 bestsellers","MRR assumes 70% of revenue comes from subscriptions"],
  visual:<div className="obMock obTiles"><div><small>MONTHLY VISITS</small><b>2.1M</b></div><div><small>EST. MONTHLY REVENUE</small><b className="amber">$1.1M</b><em>$423K–$2.0M</em></div><div><small>EST. AOV</small><b>$20</b></div><div><small>EST. MRR · 70% SUB</small><b className="green">$100K</b></div></div>},
 {icon:<Building2 size={18}/>,kicker:"Step 7 · Profile",title:"The ownership dossier in one tab",
  body:"The Profile tab shows the ownership status, the network the brand belongs to, its companies, officers and registered agents, trademarks with serials and attorneys, and business addresses.",
  points:["Ownership status: identified, legal entity only, operator unknown or contested","Reputation: BBB rating, lawsuits, regulatory actions and risk flags","Research quality shows what still needs a deep dive"],
  visual:<div className="obMock"><div className="obOwn"><ShieldCheck size={14}/><b>Owner identified</b><span className="dim">e.l.f. Beauty, Inc. · parent</span></div><div className="obTable"><span>HRBeauty LLC</span><span>IP owner</span><span>RHODE · 88984914</span><span>Trademark</span></div></div>},
 {icon:<Link2 size={18}/>,kicker:"Step 8 · Cross-brand links",title:"Find the sister brands",
  body:"Tracking IDs, Shopify stores, phones, emails, companies, people, trademark serials and funnel hosts are indexed across every investigation. When two brands share one, you'll see it under “Shared with other investigations”.",
  points:["Linked identifiers are highlighted in Pivot identifiers — click through to the other brand","Shared ad pages and personas are shown separately: they're a correlation, not ownership"],
  visual:<div className="obMock obLink"><div className="obBrand">Holior</div><div className="obVia"><span>phone · 203-516-…</span><span>trademark 99417595</span><span>Sack Consulting</span></div><div className="obBrand">Resilia</div></div>},
 {icon:<Megaphone size={18}/>,kicker:"Step 9 · Marketing",title:"The whole media-buying strategy",
  body:"The Marketing tab breaks down how the brand acquires customers: channels, angles, offers, audience and creative style, plus Meta ad volume, format, funnel and CTA mix, and the pages running the ads.",
  points:["Persona and “doctor” pages running ads are flagged","TikTok, Instagram and email activity, with recent subject lines","A yellow notice appears when ad data may belong to another company"],
  visual:<div className="obMock"><div className="obBars"><span>video</span><i style={{width:"72%"}}/><span>image</span><i style={{width:"44%"}}/><span>carousel</span><i style={{width:"12%"}}/></div><div className="obRow"><b>Dr. Dwight Brennan</b><Chip t="persona" c="warn"/><span className="dim">280 active ads</span></div></div>},
 {icon:<Route size={18}/>,kicker:"Step 10 · Landing pages",title:"Every funnel that's live right now",
  body:"Running landing pages lists each URL the brand's ads send traffic to — advertorials and presells, quizzes, offer pages, product pages, retailers and off-site review sites — with how many ads point there and who runs them.",
  points:["Off-site presell domains shared by two brands become cross-brand links","Use it to see exactly how competitors structure their funnels"],
  visual:<div className="obMock obLp"><div><span className="mono">/pages/the-hidden-invaders</span><Chip t="advertorial" c="warn"/><b>7</b></div><div><span className="mono">/products/oil-of-oregano</span><Chip t="product" c="dim"/><b>57</b></div><div><span className="mono">quiz.brand.com/start</span><Chip t="quiz" c="warn"/><b>12</b></div></div>},
 {icon:<RefreshCw size={18}/>,kicker:"Step 11 · Keep digging",title:"Research again, add evidence, start new",
  body:"Research again re-runs every source on the current investigation. Add evidence records your own findings. New investigation starts from any seed — or just use the search bar.",
  points:["Research runs in the background; a progress bar shows each step","Change a brand's category from the dropdown under its name"],
  visual:<div className="obMock obBtns"><span className="b1"><RefreshCw size={13}/> Research again</span><span className="b2">+ Add evidence</span><span className="b3">+ New investigation</span></div>},
 {icon:<Scale size={18}/>,kicker:"Last step · Research rules",title:"Business roles only",
  body:"BrandTracer is for company and business-role research. Keep it that way — it protects you and the people behind the brands.",
  points:["No home addresses, personal emails or phones, or family details","Don't claim ownership from a shared vendor, agent or address","Label every conclusion honestly — when unsure, call it a lead"],
  visual:<div className="obMock obRules"><div><Check size={14}/> Companies, officers, trademarks, filings</div><div><Check size={14}/> Business contact details on brand sites</div><div className="no">✕ Residential addresses & relatives</div><div className="no">✕ Personal emails and phone numbers</div></div>},
];

export default function Onboarding({name,onDone}:{name?:string;onDone:()=>void}){
 const [i,setI]=useState(0);const [seen,setSeen]=useState(0);const [drag,setDrag]=useState(0);const [saving,setSaving]=useState(false);
 const start=useRef<{x:number;y:number;id:number}|null>(null);
 const last=CARDS.length-1;
 const go=useCallback((n:number)=>{const t=Math.max(0,Math.min(last,n));setI(t);setSeen(s=>Math.max(s,t))},[last]);
 async function finish(){setSaving(true);await fetch("/api/auth/onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({done:true})}).catch(()=>{});onDone()}
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==="ArrowRight")go(i+1);if(e.key==="ArrowLeft")go(i-1)};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[i,go]);
 useEffect(()=>{const o=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=o}},[]);
 const onDown=(e:React.PointerEvent)=>{if((e.target as HTMLElement).closest("button"))return;start.current={x:e.clientX,y:e.clientY,id:e.pointerId};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)};
 const onMove=(e:React.PointerEvent)=>{if(!start.current)return;const dx=e.clientX-start.current.x;if(Math.abs(dx)>Math.abs(e.clientY-start.current.y))setDrag((i===0&&dx>0)||(i===last&&dx<0)?dx/4:dx)};
 const onUp=()=>{if(!start.current)return;start.current=null;if(drag<-60)go(i+1);else if(drag>60)go(i-1);setDrag(0)};
 const c=CARDS[i];
 return <div className="ob" role="dialog" aria-modal="true" aria-labelledby="obTitle">
  <div className="obWrap">
   <div className="obTop"><span>{i===0&&name?`Hi ${name.split(" ")[0]} — quick tour`:"Getting started"}</span><span className="dim">{i+1} / {CARDS.length}</span></div>
   <div className="obProgress"><i style={{width:`${(i+1)/CARDS.length*100}%`}}/></div>
   <div className="obViewport" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
    <div className="obTrack" style={{transform:`translateX(calc(${-i*100}% + ${drag}px))`,transition:drag?"none":undefined}}>
     {CARDS.map((k,j)=><article key={j} className="obCard" aria-hidden={j!==i}>
      <div className="obVisual">{k.visual}</div>
      <div className="obText">
       <div className="obKicker">{k.icon}{k.kicker}</div>
       <h2 id={j===i?"obTitle":undefined}>{k.title}</h2>
       <p>{k.body}</p>
       {k.points&&<ul>{k.points.map((p,n)=><li key={n}><Check size={13}/>{p}</li>)}</ul>}
      </div>
     </article>)}
    </div>
   </div>
   <div className="obNav">
    <button className="obBack" onClick={()=>go(i-1)} disabled={i===0}><ArrowLeft size={16}/> Back</button>
    <div className="obDots">{CARDS.map((_,j)=><button key={j} aria-label={`Card ${j+1}`} className={j===i?"on":j<=seen?"seen":""} onClick={()=>j<=seen&&go(j)} disabled={j>seen}/>)}</div>
    {i<last?<button className="obNext" onClick={()=>go(i+1)}>Next <ArrowRight size={16}/></button>
     :<button className="obNext" onClick={finish} disabled={saving}>Start investigating <ArrowRight size={16}/></button>}
   </div>
   <p className="obHint dim">Swipe, use the arrow keys, or tap Next. {c.kicker==="Welcome"?"You can replay this tour anytime from your account menu.":""}</p>
  </div>
 </div>;
}

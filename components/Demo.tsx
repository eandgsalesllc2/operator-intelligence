"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,ArrowRight,Building2,Fingerprint,Megaphone,Network,Play,Scale,Search,Star,TrendingUp,X} from "lucide-react";

// Use-case walkthroughs: pick a job-to-be-done, step through it visually, then "Try it live" runs it in the real app.
export type DemoAction={type:"case";id:string;tab?:string}|{type:"networks"}|{type:"watchlist"}|{type:"cmd";q:string};
type Step={title:string;body:string;visual:React.ReactNode};
type UseCase={id:string;icon:React.ReactNode;title:string;who:string;steps:Step[];try:{label:string;action:DemoAction}};

const Tag=({t,c}:{t:string;c:string})=><span className={"obChip "+c}>{t}</span>;
const Search1=({q}:{q:string})=><div className="obSearch"><Search size={14}/> {q}<span className="obCaret"/></div>;

const CASES:UseCase[]=[
 {id:"owner",icon:<Building2 size={18}/>,title:"Who really owns this brand?",who:"Due diligence, M&A, competitive intel",
  try:{label:"Open Resilia's ownership file",action:{type:"case",id:"sp26-resilia",tab:"profile"}},
  steps:[
   {title:"Search the brand",body:"Press ⌘K (or click search) and type the brand or its domain. Existing case files appear instantly; anything new can be researched in one click.",visual:<div className="obMock"><Search1 q="resilia"/><div className="obRow"><b>Resilia</b><span className="dim">resilia.shop · Metabolic &amp; weight</span></div><div className="obRow hi"><Search size={13}/> Research “resilia”</div></div>},
   {title:"Read the verdict",body:"The case file opens with an ownership stamp and a one-paragraph summary that separates the legal seller from the real operator.",visual:<div className="obMock"><div className="demoSheet"><span className="demoStamp bad">OWNERSHIP<br/>CONTESTED</span><b className="demoName">Resilia</b><p>Merchant of record: <b>Sack Consulting Inc.</b> Day-to-day operations appear to run through <b>Incubator Lab</b> — no filing links the two yet.</p></div></div>},
   {title:"Check the paper trail",body:"The Profile tab lists the companies, officers, registered agents and trademarks — with serial numbers and filing dates.",visual:<div className="obMock"><div className="obTable"><span>Sack Consulting Inc.</span><span>legal seller</span><span>Johnathan P. Sack</span><span>officer</span><span>RESILIA · 99417595</span><span>trademark</span></div></div>},
   {title:"Verify every claim",body:"Each link carries a confidence label, and the Evidence tab shows the exact source behind it — registries, USPTO, the brand's own terms.",visual:<div className="obMock obConf"><div><Tag t="CONFIRMED" c="ok"/><span>USPTO record names Sack Consulting</span></div><div><Tag t="STRONG" c="blue"/><span>Terms of service name the seller</span></div><div><Tag t="LEAD" c="dim"/><span>Incubator Lab as operator</span></div></div>},
  ]},
 {id:"network",icon:<Network size={18}/>,title:"Find sister brands and the operator behind them",who:"Spot portfolios, clones and hidden competitors",
  try:{label:"Open the Networks board",action:{type:"networks"}},
  steps:[
   {title:"Look for shared identifiers",body:"Every brand's phones, emails, companies, people, tracking pixels and trademark serials are indexed. On a case file, “Shared with other investigations” shows who else uses them.",visual:<div className="obMock obLink"><div className="obBrand">Resilia</div><div className="obVia"><span>phone 203-516-…</span><span>trademark 99417595</span><span>Sack Consulting</span></div><div className="obBrand">Holior</div></div>},
   {title:"See the whole operator network",body:"The Networks page pins linked brands together. Red string = a hard shared identifier; dashed amber = a softer overlap such as a shared domain reference.",visual:<svg viewBox="0 0 260 150" className="obSvg"><g strokeWidth="2"><line x1="70" y1="45" x2="190" y2="45" stroke="#c2412d"/><line x1="70" y1="45" x2="130" y2="115" stroke="#e0a93f" strokeDasharray="5 4"/><line x1="190" y1="45" x2="130" y2="115" stroke="#e0a93f" strokeDasharray="5 4"/></g>{[[70,45,"Resilia"],[190,45,"Holior"],[130,115,"AlphaInfuse"]].map(([x,y,t])=><g key={String(t)}><rect x={(x as number)-42} y={(y as number)-14} width="84" height="28" rx="2" fill="#efe6d6"/><circle cx={x as number} cy={(y as number)-14} r="4" fill="#c2412d"/><text x={x as number} y={(y as number)+4} textAnchor="middle" fontSize="11" fill="#1d1a16">{t}</text></g>)}</svg>},
   {title:"Know what links them",body:"Open “What links them” under a board to see the exact shared values — and remember a shared identifier is a strong lead, not proof of ownership on its own.",visual:<div className="obMock"><div className="obRow"><b>Resilia ↔ Holior</b><span className="dim">phone · trademark · company · person</span></div><div className="obRow"><b>Resilia ↔ AlphaInfuse</b><span className="dim">domain reference</span></div></div>},
  ]},
 {id:"trace",icon:<Fingerprint size={18}/>,title:"Trace an ID or phone to every brand",who:"Start from a pixel, GTM container, phone or email",
  try:{label:"Search a phone number",action:{type:"cmd",q:"203-516-7743"}},
  steps:[
   {title:"Paste any identifier",body:"Found a Meta pixel, GTM container, Shopify store, support phone or email on a site? Paste it into ⌘K search.",visual:<div className="obMock"><Search1 q="203-516-7743"/></div>},
   {title:"See every brand that uses it",body:"BrandTracer searches every case file's identifier index and graph, and lists each brand where it appears — with what kind of identifier it is.",visual:<div className="obMock"><div className="obRow"><b>203-516-7743</b><span className="dim">Phone · in Holior</span></div><div className="obRow"><b>203-516-7743</b><span className="dim">Phone · in Resilia</span></div></div>},
   {title:"Jump in and keep pivoting",body:"Open any match to land on its case file, then pivot again from its companies, people and IDs.",visual:<div className="obMock obBtns"><span className="b1"><Search size={13}/> Open Holior</span><span className="b2">Research this company</span></div>},
  ]},
 {id:"funnel",icon:<Megaphone size={18}/>,title:"Reverse-engineer a competitor's funnel and ads",who:"Media buyers and growth teams",
  try:{label:"Open Auri's marketing",action:{type:"case",id:"sp26-tryauri",tab:"marketing"}},
  steps:[
   {title:"How the money moves",body:"The Marketing tab starts with the path from ad to sale: which pages run the ads, whether there's a presell or quiz, and where the checkout happens.",visual:<div className="obMock"><div className="demoFlow"><span>Ads<b>303</b></span><i/><span>Presell<b>61</b></span><i/><span className="hot">Store<b>242</b></span></div></div>},
   {title:"Every live landing page",body:"See each URL their ads send traffic to — advertorials, quizzes, offer pages, product pages — with how many ads point there and who runs them.",visual:<div className="obMock obLp"><div><span className="mono">/pages/…-advertorial</span><Tag t="presell" c="warn"/><b>36</b></div><div><span className="mono">/products/focus-gummies</span><Tag t="product" c="dim"/><b>14</b></div></div>},
   {title:"The ad wall",body:"Browse their live creatives — videos play inline — filter by format and sort by impressions or longest running to find the winners.",visual:<div className="obMock demoWall"><span><Play size={16}/></span><span><Play size={16}/></span><span/><span><Play size={16}/></span></div>},
   {title:"Persona pages and strategy",body:"Pages running ads through “doctor” or persona accounts are flagged, and an acquisition-strategy summary spells out channels, angles, offers and audience.",visual:<div className="obMock"><div className="obRow"><b>Mushroom Insider</b><Tag t="persona" c="warn"/><span className="dim">300 active</span></div><div className="obRow"><b>Auri Nutrition</b><span className="dim">brand page</span></div></div>},
  ]},
 {id:"size",icon:<TrendingUp size={18}/>,title:"Size a brand: traffic, revenue and MRR",who:"Investors, operators and agencies",
  try:{label:"Open Resilia's numbers",action:{type:"case",id:"sp26-resilia"}},
  steps:[
   {title:"The headline numbers",body:"Every case file shows monthly visits, an estimated monthly revenue range, estimated AOV, active Meta ads and — for subscription brands — estimated MRR.",visual:<div className="obMock obTiles"><div><small>VISITS</small><b>9.9M</b></div><div><small>EST. REV</small><b className="amber">$9.2M</b></div><div><small>EST. AOV</small><b>$36</b></div><div><small>EST. MRR</small><b className="green">$6.5M</b></div></div>},
   {title:"How the estimate works",body:"Revenue = visits × 1–3% conversion × average order value from the top bestsellers. MRR assumes 70% of revenue is subscription, and only for brands that sell subscriptions. Estimates, not reported figures.",visual:<div className="obMock"><div className="obRow"><b>9.9M visits</b><span className="dim">× 1–3% × $36 AOV</span></div><div className="obRow hi">≈ $3.6M – $17.1M / month</div></div>},
   {title:"Compare the whole market",body:"Case files can be sorted by traffic, revenue or ad volume and filtered by category or flags like Subscription — a fast way to rank a category.",visual:<div className="obMock obTree"><b>SORT BY REVENUE</b><span>1&nbsp; Resilia <small>~$9.2M/mo</small></span><span>2&nbsp; Prime Prometics</span><span>3&nbsp; Laura Geller</span></div>},
  ]},
 {id:"monitor",icon:<Star size={18}/>,title:"Monitor competitors every week",who:"Stay ahead without re-researching",
  try:{label:"Open your Watchlist",action:{type:"watchlist"}},
  steps:[
   {title:"Star the brands you care about",body:"Hit Watch on a case file, or the star on its card. Your watchlist is private to you.",visual:<div className="obMock obBtns"><span className="b3"><Star size={13}/> Watching</span></div>},
   {title:"Weekly re-checks",body:"Every week BrandTracer re-pulls their traffic, ads, landing pages, persona pages and links to other brands — and compares against last time.",visual:<div className="obMock"><div className="obRow"><b>Auri Nutrition</b><span className="dim">checked this week</span></div><div className="obRow"><b>Resilia</b><span className="dim">checked this week</span></div></div>},
   {title:"See what changed",body:"New presells, persona pages ramping up, big swings in ads or traffic, new subscription plans and new links to other brands land in your What changed feed.",visual:<div className="obMock"><div className="obEv"><Tag t="NOTABLE" c="warn"/><div><b>New product page in rotation</b><span className="dim">/products/kids-daily-gummies · 6 ads</span></div></div><div className="obEv"><Tag t="MAJOR" c="bad"/><div><b>Now linked to another brand</b><span className="dim">shares a Meta pixel</span></div></div></div>},
  ]},
];

export default function Demo({onClose,onAction}:{onClose:()=>void;onAction:(a:DemoAction)=>void}){
 const [uc,setUc]=useState<UseCase|null>(null);const [i,setI]=useState(0);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();if(uc){if(e.key==="ArrowRight")setI(x=>Math.min(uc.steps.length,x+1));if(e.key==="ArrowLeft")setI(x=>Math.max(0,x-1))}};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[uc,onClose]);
 const pick=(u:UseCase)=>{setUc(u);setI(0)};
 const last=uc?i>=uc.steps.length:false;const st=uc&&!last?uc.steps[i]:null;
 return <div className="ob demo" role="dialog" aria-modal="true" aria-label="BrandTracer demo">
  <div className="obWrap">
   <div className="obTop"><span>{uc?<button className="demoBack" onClick={()=>setUc(null)}><ArrowLeft size={14}/> All use cases</button>:"DEMO · WHAT YOU CAN DO WITH BRANDTRACER"}</span><button className="demoClose" onClick={onClose} aria-label="Close demo"><X size={16}/></button></div>
   {!uc?<>
    <h2 className="demoH">Pick a use case to see it step by step</h2>
    <div className="demoGrid">{CASES.map(u=><button key={u.id} className="demoCard" onClick={()=>pick(u)}><span className="demoIcon">{u.icon}</span><b>{u.title}</b><small>{u.who}</small><span className="demoGo">{u.steps.length} steps <ArrowRight size={13}/></span></button>)}</div>
   </>:<>
    <div className="obProgress"><i style={{width:`${Math.min(1,(i+1)/(uc.steps.length+1))*100}%`}}/></div>
    {st?<div className="obCard demoStep"><div className="obVisual">{st.visual}</div><div className="obText"><div className="obKicker">{uc.icon}{uc.title} · step {i+1} of {uc.steps.length}</div><h2>{st.title}</h2><p>{st.body}</p></div></div>
    :<div className="demoDone"><div className="obKicker">{uc.icon}{uc.title}</div><h2>Now try it on real data</h2><p>This opens the live app exactly where the walkthrough ends.</p><button className="obNext" onClick={()=>{onAction(uc.try.action);onClose()}}><Play size={15}/> {uc.try.label}</button></div>}
    <div className="obNav"><button className="obBack" onClick={()=>setI(x=>Math.max(0,x-1))} disabled={i===0}><ArrowLeft size={16}/> Back</button>
     <div className="obDots">{[...uc.steps,null].map((_,j)=><button key={j} aria-label={j<uc.steps.length?`Step ${j+1}`:"Try it"} className={j===i?"on":j<i?"seen":""} onClick={()=>setI(j)}/>)}</div>
     {!last?<button className="obNext" onClick={()=>setI(x=>x+1)}>Next <ArrowRight size={16}/></button>:<button className="obBack" onClick={()=>setUc(null)}>Other use cases</button>}</div>
   </>}
  </div>
 </div>;
}

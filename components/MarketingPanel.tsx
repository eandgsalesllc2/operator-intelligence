"use client";
import {Case} from "@/lib/types";
import {compact} from "@/lib/metrics";
import AdWall from "./AdWall";
import {Megaphone,Target,Mail,PlayCircle,Users,Flag,Route,Link2} from "lucide-react";

const KIND_TONE:Record<string,string>={advertorial:"warn",quiz:"warn",offer_lp:"",product:"dim",collection:"dim",home:"dim",marketplace:"",external:"bad",checkout:"dim"};
const KIND_LABEL:Record<string,string>={advertorial:"advertorial / presell",offer_lp:"offer page",product:"product page",collection:"collection",home:"homepage",quiz:"quiz",checkout:"checkout",marketplace:"marketplace",external:"off-site"};

const SCALE_TONE:Record<string,string>={"very high":"bad","high":"warn","medium":"","low":"dim","minimal":"dim"};

function Bars({data,total}:{data?:Record<string,number>;total?:number}){
 const entries=Object.entries(data||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
 const sum=total||entries.reduce((s,[,v])=>s+v,0);
 if(!entries.length||!sum)return <span className="dim">—</span>;
 return <div className="bars">{entries.slice(0,6).map(([k,v])=><div key={k} className="bar"><span>{k.replace(/_/g," ").toLowerCase()}</span><i><em style={{width:`${Math.max(2,Math.round(v/sum*100))}%`}}/></i><b>{v.toLocaleString()}</b></div>)}</div>;
}
function Chips({items,tone}:{items?:string[];tone?:string}){return items&&items.length?<div className="chips">{items.map((x,i)=><span key={i} className={"chipTag "+(tone||"")}>{x}</span>)}</div>:<span className="dim">—</span>}


// "How the money moves": ad sources → presell → where the sale happens, from Meta pages and live landing pages.
function MoneyStrip({m}:{m:NonNullable<Case["marketing"]>}){
 const pages=m.meta?.pages||[];const lp=m.landing?.landingPages||[];
 const brandAds=pages.filter(p=>!p.persona).reduce((s,p)=>s+(p.activeAds||0),0),personaAds=pages.filter(p=>p.persona).reduce((s,p)=>s+(p.activeAds||0),0);
 const sum=(ks:string[])=>lp.filter(l=>ks.includes(l.kind||"")).reduce((s,l)=>s+(l.activeAds||0),0);
 const top=(ks:string[])=>lp.filter(l=>ks.includes(l.kind||"")).sort((a,b)=>(b.activeAds||0)-(a.activeAds||0))[0];
 const pre=["advertorial","quiz","offer_lp"],store=["product","collection","home","checkout"],off=["marketplace","external"];
 const steps=[
  {k:"01 · ADS",n:m.meta?.activeAds??null,sub:personaAds?`${compact(personaAds)} via persona pages · ${compact(brandAds)} brand`:m.meta?.activeAds!=null?"from the brand's own pages":"no Meta ads tracked",hot:personaAds>brandAds},
  {k:"02 · PRESELL",n:sum(pre)||null,sub:top(pre)?`${top(pre)!.kind==="quiz"?"quiz":top(pre)!.kind==="advertorial"?"advertorial":"offer page"} ${top(pre)!.path}`:"straight to the store",hot:sum(pre)>0},
  {k:"03 · STORE",n:sum(store)||null,sub:top(store)?`${top(store)!.path}`:"—",hot:false},
  ...(sum(off)?[{k:"04 · OFF-SITE",n:sum(off),sub:`${top(off)!.host}${top(off)!.path}`,hot:true}]:[]),
 ];
 if(!m.meta&&!lp.length)return null;
 return <section className="money"><h4>How the money moves</h4><ol>{steps.map((st,i)=><li key={i} className={st.hot?"hot":""}><span className="mk">{st.k}</span><b>{st.n!=null?compact(st.n):"—"}</b><span className="ms">{st.sub}</span></li>)}</ol><p className="dim small">Counts are active ads. Ads per page come from BrandSearch; landing pages from Atria{m.landing?.sampledActiveAds?` (top ${m.landing.sampledActiveAds} ads by impressions)`:""}.</p></section>;
}

export default function MarketingPanel({c}:{c:Case}){
 const m=c.marketing;
 if(!m)return <div className="panel"><div className="emptyPanel">No marketing data yet for this investigation.</div></div>;
 const s=m.strategy||{};const meta=m.meta;
 return <div className="profile">
  {m.dataWarning&&<div className="notice"><Flag size={15}/><span><b>Check this data:</b> {m.dataWarning}</span></div>}
  <MoneyStrip m={m}/>
  <AdWall investigationId={c.id}/>
  <div className="pcards">
   <section className="pcard wide"><h4><Target size={14}/> Acquisition strategy {s.scale&&<span className={"chipTag "+(SCALE_TONE[s.scale]||"")}>{s.scale} ad scale</span>}</h4><p className="lead2">{s.summary||"No summary."}</p>
    <div className="kv"><span>Channels</span><Chips items={s.channels}/></div>
    <div className="kv"><span>Angles</span><Chips items={s.angles}/></div>
    <div className="kv"><span>Offers</span><Chips items={s.offers}/></div>
    <div className="kv"><span>Audience</span><Chips items={s.audience}/></div>
    <div className="kv"><span>Creative style</span><Chips items={s.creativeStyle}/></div>
    {(s.complianceFlags||[]).length>0&&<div className="kv"><span><Flag size={12}/> Compliance flags</span><Chips items={s.complianceFlags} tone="bad"/></div>}
   </section>
  </div>

  {meta&&<section className="psec"><h4><Megaphone size={14}/> Meta ads</h4>
   <div className="mstats"><div><small>Active ads</small><b>{compact(meta.activeAds)}</b></div><div><small>All-time ads</small><b>{compact(meta.totalAds)}</b></div><div><small>Advertiser pages</small><b>{meta.pages?.length??"—"}</b></div><div><small>Persona pages</small><b className={(meta.personaPageCount||0)>0?"warnTxt":""}>{meta.personaPageCount??0}</b></div><div title="EU-only: Meta publishes spend and reach only for ads shown in the EU"><small>EU spend · reach</small><b>{meta.euSpend!=null?compact(meta.euSpend,"€"):"—"}</b><span className="dim small">{meta.euReach!=null?`${compact(meta.euReach)} reached`:""}</span></div></div>
   <div className="mgrid">
    <div><h5>Format (active)</h5><Bars data={meta.activeMediaMix||meta.mediaMix}/></div>
    <div><h5>Funnel</h5><Bars data={meta.funnelMix}/></div>
    <div><h5>Call to action</h5><Bars data={meta.ctaMix}/></div>
    <div><h5>Top countries</h5><Chips items={meta.topCountries?.slice(0,12)}/></div>
   </div>
   {(meta.topAds||[]).length>0&&<><h5>Clippings · top active ads</h5><div className="ads clippings">{meta.topAds!.map((a,i)=><article key={i} className="adCard"><div className="adTop"><span className="chipTag">{a.angle||"—"}</span><span className="dim small">{a.format}{a.cta?` · ${a.cta}`:""}{a.euReach!=null?` · ${compact(a.euReach)} EU reach`:""}</span></div>{a.headline&&<b>{a.headline}</b>}<p>“{a.hook}”</p>{a.landing&&<span className="mono small dim">→ {a.landing}{a.funnel?` (${a.funnel})`:""}</span>}</article>)}</div></>}
   {(meta.pages||[]).length>0&&<><h5><Users size={13}/> Pages running the ads</h5><div className="tableWrap"><table className="ptable"><thead><tr><th>Page</th><th>Type</th><th>Ads (active)</th><th>Likes</th><th>EU spend</th><th>Created</th></tr></thead><tbody>{meta.pages!.map((p,i)=><tr key={i}><td><b>{p.name}</b></td><td>{p.persona?<span className="chipTag warn">persona</span>:"brand"}</td><td>{(p.ads||0).toLocaleString()} ({(p.activeAds||0).toLocaleString()})</td><td>{p.likes!=null?p.likes.toLocaleString():"—"}</td><td>{p.euSpend?compact(p.euSpend,"€"):"—"}</td><td>{p.created||"—"}</td></tr>)}</tbody></table></div></>}
  </section>}

  <div className="pcards">
   <section className="pcard"><h4><PlayCircle size={14}/> TikTok</h4>{m.tiktok&&m.tiktok.posts?<><p><b>{compact(m.tiktok.posts)}</b> posts · <b>{compact(m.tiktok.plays)}</b> plays</p><p className="dim small">{compact(m.tiktok.likes)} likes · {compact(m.tiktok.shares)} shares · best post {compact(m.tiktok.maxPlays)} plays</p></>:<p className="dim">No TikTok activity tracked.</p>}</section>
   <section className="pcard"><h4><PlayCircle size={14}/> Instagram</h4>{m.instagram&&m.instagram.posts?<><p><b>{compact(m.instagram.posts)}</b> posts · <b>{compact(m.instagram.likes)}</b> likes</p><p className="dim small">{compact(m.instagram.comments)} comments · best post {compact(m.instagram.maxLikes)} likes</p></>:<p className="dim">No Instagram activity tracked.</p>}</section>
   <section className="pcard"><h4><Mail size={14}/> Email</h4>{m.email&&m.email.total?<><p><b>{m.email.total}</b> emails captured · {m.email.marketing||0} marketing · {m.email.abandonedCart||0} abandoned-cart</p><p className="dim small">{m.email.firstSent?.slice(0,10)} → {m.email.lastSent?.slice(0,10)}</p>{(m.email.recentSubjects||[]).length>0&&<ul className="subjects">{m.email.recentSubjects!.map((x,i)=><li key={i}>{x}</li>)}</ul>}</>:<p className="dim">No emails captured.</p>}</section>
  </div>

  {m.landing&&<section className="psec"><h4><Link2 size={14}/> Running landing pages</h4>
   {m.landing.notes&&<p className="lead2">{m.landing.notes}</p>}
   <div className="mgrid">
    <div><h5>Ads by page type (Atria)</h5><Bars data={Object.fromEntries(Object.entries(m.landing.kindMix||{}).map(([k,v])=>[KIND_LABEL[k]||k,v]))}/></div>
    <div><h5>Funnel type (BrandSearch)</h5><Bars data={m.landing.brandsearchFunnelMix||undefined}/></div>
    <div><h5>Hosts</h5><Chips items={(m.landing.hosts||[]).slice(0,8).map(h=>`${h.host} · ${h.activeAds}`)}/></div>
   </div>
   {(m.landing.landingPages||[]).length>0?<div className="tableWrap"><table className="ptable"><thead><tr><th>Landing page</th><th>Type</th><th>Ads</th><th>Best rank</th><th>Days live</th><th>Run by</th></tr></thead><tbody>{m.landing.landingPages!.map((l,i)=><tr key={i}><td className="lpcell"><a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="mono small">{(l.host||"")+(l.path||"")}</a>{l.headline&&<div className="dim small">“{l.headline}”</div>}</td><td><span className={"chipTag "+(KIND_TONE[l.kind||""]||"")}>{KIND_LABEL[l.kind||""]||l.kind||"—"}</span>{l.status==="inactive"&&<span className="chipTag dim">ended</span>}</td><td>{l.activeAds??"—"}</td><td>{l.bestRank??"—"}</td><td>{l.maxDaysRunning??"—"}</td><td className="small">{(l.pages||[]).slice(0,3).join(", ")}{(l.pages||[]).length>3?` +${l.pages!.length-3}`:""}</td></tr>)}</tbody></table></div>:<p className="dim">No running ads with landing pages found in Atria.</p>}
   {(m.landing.advertisers||[]).filter(a=>a.role!=="main").length>0&&<p className="dim small">Other pages whose ads link to this site: {m.landing.advertisers!.filter(a=>a.role!=="main").slice(0,10).map(a=>`${a.name} (${a.totalAds??"?"} ads)`).join(", ")}</p>}
   <p className="dim small">{m.landing.sampledActiveAds!=null?`Sampled ${m.landing.sampledActiveAds} of ${m.landing.totalActiveAds??"?"} active ads by impressions. `:""}Source: Atria ad library{m.landing.brandsearchFunnelMix?" + BrandSearch":""}{m.landing.asOf?` · ${m.landing.asOf}`:""}.</p>
  </section>}

  {m.funnel&&<section className="psec"><h4><Route size={14}/> Funnel</h4>
   <div className="kv"><span>Landing domains</span><Chips items={m.funnel.landingDomains}/></div>
   <div className="kv"><span>Checkout subdomains</span><Chips items={m.funnel.checkoutSubdomains}/></div>
   <div className="kv"><span>Presell / advertorial</span><div>{m.funnel.usesPresellOrAdvertorial==null?"—":m.funnel.usesPresellOrAdvertorial?"Yes":"No"}</div></div>
   {m.funnel.notes&&<p className="dim small">{m.funnel.notes}</p>}
  </section>}
  <p className="dim small">Source: <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">BrandSearch</a>{m.asOf?` · ${m.asOf}`:""}. Meta spend and reach are only published for ads shown in the EU.</p>
 </div>;
}

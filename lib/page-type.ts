// What kind of page an ad sends traffic to: PDP, listicle, advertorial, quiz, offer page… First from the URL and ad
// headline, then (for the pages that matter) from the page itself — Shopify page type, product markup, numbered
// headings, article bylines, quiz builders. Tracking links are followed to the page they land on.
import {safeFetch} from "./net";

import type {PageKind} from "./page-kinds";
export {PAGE_KIND_LABEL} from "./page-kinds";

const MARKET=/(^|\.)(amazon\.|amzn\.|walmart\.|target\.com|costco\.|samsclub\.|sephora\.|ulta\.|cvs\.|walgreens\.|tiktok\.com)/;
const SOCIAL=/(^|\.)(facebook\.com|fb\.me|instagram\.com|linktr\.ee|youtube\.com)$/;
const LIST_WORDS="reasons|ways|things|signs|secrets|facts|benefits|tips|mistakes|habits|foods|tricks|myths|products|picks";
const LIST_URL=new RegExp(`listicle|(^|[-/_])(top-?\\d+|\\d+-(?:${LIST_WORDS}))([-/_.]|$)|reasons-why|-list(-|$)|best-.+-(of|for)-`);
const LIST_TITLE=new RegExp(`^\\W*(top\\s+)?(\\d{1,2}|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+(\\w+\\s+){0,3}(${LIST_WORDS})\\b`,"i");
const RANKING=/\b(top[- ]?\d+|\d+\s+best|top[- ]ranked|best\s.{3,60}\s(of|for|in)\s20\d\d|20\d\d'?s? best)\b/i;
const PRESELL_TITLE=/\b(shocked|stunned|breaking|revealed|exposed|doctors? (say|warn|reveal)|dermatologists?|surgeons?|nurse|scientists|new study|the truth about|you won'?t believe|here'?s why|this is why|why (women|men|doctors|everyone)|discovered|finally|secret)\b/i;
const ADV_URL=/advertorial|(^|[-/_])adv\d*([-/_]|$)|article|story|news|blog|review|nurse|doctor|expert|discover|(^|\/)why-|presell|(^|[-/_])pre-?lander/;
const QUIZ_URL=/quiz|survey|assessment|find-your|questionnaire/;

// Best guess from the URL and ad headline alone.
export function urlKind(host:string,path:string,own:boolean,headline=""):PageKind{
 const p=path.toLowerCase(),h=host.toLowerCase();
 if(MARKET.test(h))return "marketplace";
 if(QUIZ_URL.test(h+p))return "quiz";
 if(/checkout|\/cart/.test(p))return "checkout";
 if(LIST_URL.test(p)||LIST_TITLE.test(headline)||RANKING.test(headline))return "listicle";
 if(ADV_URL.test(p)||/why .* (love|switch)/i.test(headline))return "advertorial";
 if(!own)return "external";
 if(p.startsWith("/products/"))return "product";
 if(p.startsWith("/collections/"))return "collection";
 if(p===""||p==="/")return "home";
 return "offer_lp";
}

const ENT:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",ndash:"–",mdash:"—",rsquo:"’",lsquo:"‘",rdquo:"”",ldquo:"“",hellip:"…",trade:"™",reg:"®"};
const decode=(s:string)=>s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e:string)=>e[0]==="#"?String.fromCodePoint(e[1]==="x"||e[1]==="X"?parseInt(e.slice(2),16):+e.slice(1)):ENT[e.toLowerCase()]??m);
const text=(html:string)=>decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ");
const first=(re:RegExp,s:string)=>{const m=re.exec(s);return m?text(m[1]).trim():""};

// Classify from the page's HTML. Returns null when the page gives no clear signal.
export function htmlKind(html:string,path:string):PageKind|null{
 const low=html.toLowerCase();
 const title=first(/<title[^>]*>([\s\S]*?)<\/title>/i,html),h1=first(/<h1[^>]*>([\s\S]*?)<\/h1>/i,html);
 const shopType=/"pageType"\s*:\s*"([a-z_]+)"/.exec(html)?.[1]||/shopifyanalytics\.meta\.page\s*=\s*\{[^}]*"pagetype"\s*:\s*"([a-z_]+)"/.exec(low)?.[1]||"";
 // Quiz builders embedded on the page, or the page itself is a quiz.
 if(/typeform\.com\/to\/|form\.typeform\.com|heyflow\.(app|site)|data-quiz-id|octaneai\.com\/quiz|revenuehunt\.com\/quiz|involve\.me\/|perspective\.co\/|quiz\.kiwi/.test(low)||/\b(take|start) (the|our|this) quiz\b|\bquiz\b/i.test(h1+" "+title))return "quiz";
 // Numbered headings: "1. …", "#2 …", "Reason 3:" — three or more makes it a listicle.
 const heads=[...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m=>text(m[1]).trim());
 const numbered=heads.filter(t=>/^(#\s*|no\.\s*|reason\s*#?\s*|step\s*)?\d{1,2}\s*[.):\-–]\s*\S|^#\d{1,2}\b|^reason\s*#?\d{1,2}\b/i.test(t)).length;
 const listTitle=LIST_TITLE.test(h1)||LIST_TITLE.test(title);
 if(numbered>=3||(listTitle&&numbered>=1))return "listicle";
 if(shopType==="product"||/<meta[^>]+property=["']og:type["'][^>]+content=["']product["']/i.test(html)||/\bpdp\b/i.test(title))return "product";
 if(listTitle||RANKING.test(h1)||RANKING.test(title))return "listicle";
 // Advertorial: disclosure, article markup with a byline/date, or a long editorial page.
 const disclosure=/\b(advertorial|paid advertisement|this is an advertisement|sponsored (content|article|post)|advertising disclosure)\b/.test(low);
 const words=text(html).split(" ").length;
 const byline=/\bby\s+(dr\.?\s+)?[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text(html).slice(0,6000))&&/\b(updated|published|posted|min read|\d{1,2},? 20\d\d)\b/i.test(text(html).slice(0,8000));
 if(disclosure||(/<article[\s>]/i.test(html)&&byline)||(byline&&words>900)||PRESELL_TITLE.test(h1)||PRESELL_TITLE.test(title))return "advertorial";
 if(shopType==="collection")return "collection";
 if(shopType==="home")return "home";
 if(/\/(cart|checkout)/.test(path))return "checkout";
 if(shopType==="page"||/add to cart|add-to-cart|\/cart\/add|order now|claim (your|my)|buy now/.test(low))return "offer_lp";
 return null;
}

type LP={url:string;host?:string;path?:string;kind?:string;headline?:string|null;finalUrl?:string;title?:string|null;offsite?:boolean;checkedBy?:string};

// Open each page (a few at a time) and replace the URL guess with what the page shows. Pages that fail keep the URL guess.
export async function classifyPages<T extends LP>(pages:T[],root:string,{limit=25,concurrency=5,timeoutMs=6000}={}):Promise<T[]>{
 const todo=pages.slice(0,limit).filter(p=>p.kind!=="marketplace"&&!SOCIAL.test((p.host||"").toLowerCase()));
 let i=0;
 await Promise.all(Array.from({length:concurrency},async()=>{while(i<todo.length){const p=todo[i++];
  try{
   const r=await safeFetch(p.url,{timeoutMs,maxBytes:500_000,accept:"text/html"});
   if(r.status>=400||!/html/i.test(r.contentType))continue;
   const u=new URL(r.url);const host=u.hostname.replace(/^www\./,"");const path=u.pathname.replace(/\/+$/,"")||"/";
   const own=host.endsWith(root);
   // A clear URL (".../5-reasons-why", "/adv2", "/quiz") beats a page that only looks like a generic sales page.
   const fromUrl=[urlKind(host,path,own,p.headline||""),p.kind].find(k=>k==="listicle"||k==="advertorial"||k==="quiz");
   const k=MARKET.test(host)?"marketplace":(()=>{const h=htmlKind(r.body,path);return h&&!(fromUrl&&h==="offer_lp")?h:fromUrl||h||urlKind(host,path,own,p.headline||"")})();
   p.kind=k;p.offsite=!own&&k!=="marketplace";p.checkedBy="page";
   if(r.url!==p.url)p.finalUrl=r.url;
   const t=first(/<title[^>]*>([\s\S]*?)<\/title>/i,r.body);if(t)p.title=t.slice(0,140);
  }catch{/* unreachable or blocked: keep the URL-based guess */}
 }}));
 return pages;
}

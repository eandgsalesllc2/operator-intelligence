// Structured brand profile (from dossiers / research) and marketing profile (from BrandSearch).
// Profiles feed the identifier index (oi_identifiers) used to link brands that share
// tracking IDs, accounts, contacts, companies, people or attorneys.

export type RelatedDomain={domain:string;relation:string;confidence?:string};
export type Profile={
 identifiers?:{
  shopifyStore?:string|null;shopifyShopId?:string|null;
  googleAnalytics?:string[];googleTagManager?:string[];googleAds?:string[];metaPixel?:string[];tiktokPixel?:string[];clarity?:string[];klaviyo?:string[];otherTracking?:string[];
  checkoutVendor?:string|null;checkoutAccount?:string|null;subscriptionApp?:string|null;paymentIds?:string[];amazonSellers?:string[];cardDescriptors?:string[];
  supportEmails?:string[];phones?:string[];relatedDomains?:RelatedDomain[];
 };
 entities?:{name:string;role?:string;jurisdiction?:string|null;fileNumber?:string|null;formed?:string|null;status?:string;registeredAgent?:string|null;officers?:{name:string;role?:string;confidence?:string}[];confidence?:string;source?:string|null}[];
 trademarks?:{mark:string;serial?:string|null;registration?:string|null;owner?:string|null;status?:string;filed?:string|null;firstUse?:string|null;attorney?:string|null;classes?:string|null}[];
 addresses?:{address:string;kind?:string;massAddress?:boolean;source?:string|null}[];
 reputation?:{bbbRating?:string|null;bbbComplaints?:number|null;trustpilot?:string|null;lawsuits?:{title:string;court?:string|null;caseNo?:string|null;date?:string|null;status?:string|null}[];regulatory?:{agency:string;action:string;date?:string|null}[];risks?:string[]};
 network?:{name?:string|null;parent?:string|null;siblings?:string[];predecessors?:string[];operatorCountry?:string|null};
 people?:{name:string;role?:string;confidence?:string}[];
 research?:{depth?:string;researchedAt?:string;blocked?:string[];needsDeepDive?:boolean;deepDiveReason?:string|null;ownershipStatus?:"identified"|"legal_entity_only"|"operator_unknown"|"contested";ownershipNote?:string};
};

export type Marketing={
 asOf?:string;source?:string;sourceUrl?:string;dataWarning?:string|null;
 meta?:{totalAds?:number;activeAds?:number;mediaMix?:Record<string,number>;activeMediaMix?:Record<string,number>;funnelMix?:Record<string,number>;ctaMix?:Record<string,number>;topCountries?:string[];euSpend?:number|null;euReach?:number|null;
  pages?:{name:string;likes?:number|null;ads?:number;activeAds?:number;euSpend?:number;persona?:boolean;created?:string|null}[];personaPageCount?:number;
  topAds?:{hook:string;headline?:string|null;angle?:string;format?:string;cta?:string|null;euReach?:number|null;landing?:string|null;funnel?:string|null}[]}|null;
 tiktok?:{posts?:number;plays?:number;likes?:number;shares?:number;maxPlays?:number}|null;
 instagram?:{posts?:number;likes?:number;comments?:number;maxLikes?:number}|null;
 email?:{total?:number;marketing?:number;abandonedCart?:number;confirmations?:number;firstSent?:string|null;lastSent?:string|null;recentSubjects?:string[]}|null;
 funnel?:{landingDomains?:string[];usesPresellOrAdvertorial?:boolean|null;checkoutSubdomains?:string[];notes?:string}|null;
 // Running landing pages from Atria's ad library (landing URLs) plus BrandSearch funnel types.
 landing?:{asOf?:string;source?:string;notes?:string;totalActiveAds?:number;sampledActiveAds?:number;
  advertisers?:{id:string;name:string;totalAds?:number;role?:string}[];
  landingPages?:{url:string;host?:string;path?:string;kind?:string;activeAds?:number;bestRank?:number|null;maxDaysRunning?:number|null;pages?:string[];headline?:string|null;status?:string}[];
  hosts?:{host:string;activeAds:number}[];kindMix?:Record<string,number>;brandsearchFunnelMix?:Record<string,number>|null}|null;
 strategy?:{summary?:string;channels?:string[];angles?:string[];offers?:string[];audience?:string[];creativeStyle?:string[];scale?:string;complianceFlags?:string[]}|null;
};

export type IdentifierRow={kind:string;value:string;normalized:string};

const norm=(kind:string,v:string)=>{
 let s=String(v).trim().toLowerCase();
 if(kind==="phone"){const d=s.replace(/\D/g,"");return d.length>=10?d.slice(-10):d}
 if(kind==="domain")s=s.replace(/^[a-z]+:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0];
 if(kind==="company"||kind==="person"||kind==="attorney")s=s.replace(/[.,]/g,"").replace(/\s+/g," ").replace(/\b(llc|inc|incorporated|corp|corporation|ltd|limited|co|pbc|llp|pllc|plc|sa|ag|gmbh|bv)\b/g,"").trim();
 return s;
};
export const normalizeIdentifier=(kind:string,v:string)=>norm(kind,v);

// Service providers and vendor constants that appear across unrelated stores; never treat as links.
const IGNORE=new Set(["1220658","shopify","gmail.com"]);

// App/vendor names ("Triple Whale", "Recharge") are shared by unrelated stores; only real account IDs or script hosts link brands.
const isTrackingId=(v:string)=>/\d/.test(v)&&!/\s/.test(v.trim());

export function identifierRows(p?:Profile|null,m?:Marketing|null,ownDomain?:string|null):IdentifierRow[]{
 if(!p&&!m)return [];p=p||{};
 const out:IdentifierRow[]=[];const seen=new Set<string>();
 const add=(kind:string,v?:string|null)=>{if(!v)return;const n=norm(kind,v);if(n.length<4||IGNORE.has(n))return;const k=kind+"|"+n;if(seen.has(k))return;seen.add(k);out.push({kind,value:String(v).trim(),normalized:n})};
 const id=p.identifiers||{};
 add("shopify_store",id.shopifyStore);add("shopify_shop_id",id.shopifyShopId);
 id.googleAnalytics?.forEach(v=>add("google_analytics",v));id.googleTagManager?.forEach(v=>add("gtm",v));id.googleAds?.forEach(v=>add("google_ads",v));
 id.metaPixel?.forEach(v=>add("meta_pixel",v));id.tiktokPixel?.forEach(v=>add("tiktok_pixel",v));id.clarity?.forEach(v=>add("clarity",v));id.klaviyo?.forEach(v=>add("klaviyo",v));id.otherTracking?.forEach(v=>{if(isTrackingId(v))add("tracking",v)});
 add("checkout_account",id.checkoutAccount);id.paymentIds?.forEach(v=>add("payment_id",v));id.amazonSellers?.forEach(v=>add("amazon_seller",v));id.cardDescriptors?.forEach(v=>add("card_descriptor",v));
 id.supportEmails?.forEach(v=>add("email",v));id.phones?.forEach(v=>add("phone",v));id.relatedDomains?.forEach(d=>add("domain",d.domain));
 p.entities?.forEach(e=>{if(!/^other$|vendor|provider|processor|registered agent/i.test(e.role||""))add("company",e.name);e.officers?.forEach(o=>add("person",o.name))});
 p.people?.forEach(x=>add("person",x.name));
 p.trademarks?.forEach(t=>{add("trademark_serial",t.serial);add("attorney",t.attorney)});
 p.addresses?.forEach(a=>{if(!a.massAddress&&a.kind!=="registered_agent")add("address",a.address)});
 // Off-site funnel hosts (presell/advertorial domains) that ads send traffic to; retailers, social platforms and landing-page vendors are shared by everyone.
 const own=(ownDomain||"").replace(/^www\./,"").split(".").slice(-2).join(".");
 m?.landing?.landingPages?.forEach(l=>{const h=(l.host||"").toLowerCase().replace(/^www\./,"");if(!h||(own&&h.endsWith(own))||l.kind==="marketplace"||/amazon\.|amzn\.|walmart\.|target\.com|costco\.|samsclub\.|sephora\.|ulta\.|cvs\.|walgreens\.|tiktok\.|facebook\.|(^|\.)fb\.(com|me)$|instagram\.|linktr\.ee|myshopify\.com$|apple\.com|google\.|gotoaisle\.com$|click2cart\.|wayvia\.|mikmak\.|ampd\.to$|substack\.com$/.test(h))return;add("funnel_host",h)});
 // Facebook/Instagram pages that actually run ads to this brand's landing pages (brand, persona, doctor, creator pages).
 m?.landing?.landingPages?.forEach(l=>l.pages?.forEach(pg=>add("ad_page",pg)));
 return out;
}

export const KIND_LABEL:Record<string,string>={shopify_store:"Shopify store",shopify_shop_id:"Shopify shop ID",google_analytics:"Google Analytics",gtm:"Tag Manager",google_ads:"Google Ads",meta_pixel:"Meta pixel",tiktok_pixel:"TikTok pixel",clarity:"Clarity",klaviyo:"Klaviyo",tracking:"Tracking ID",checkout_account:"Checkout account",payment_id:"Payment ID",amazon_seller:"Amazon seller",card_descriptor:"Card descriptor",email:"Email",phone:"Phone",domain:"Domain",company:"Company",person:"Person",trademark_serial:"Trademark serial",attorney:"Trademark attorney",address:"Address",funnel_host:"Funnel host",ad_page:"Ad page"};
// Kinds that are strong operator signals when shared, vs. ones that only show a common service provider.
export const STRONG_KINDS=new Set(["shopify_store","shopify_shop_id","google_analytics","gtm","google_ads","meta_pixel","tiktok_pixel","clarity","klaviyo","checkout_account","payment_id","amazon_seller","card_descriptor","email","phone","company","person","trademark_serial","domain","address","funnel_host"]);

// Compact labels stored on the investigation for filtering in the sidebar.
export function tagsFor(p?:Profile|null,m?:Marketing|null,network?:string|null):string[]{
 const t=new Set<string>();
 const own=p?.research?.ownershipStatus;if(own)t.add("ownership:"+own);
 if(p?.research?.needsDeepDive)t.add("needs-deep-dive");
 if(p?.research?.depth)t.add("depth:"+p.research.depth);
 const bbb=p?.reputation?.bbbRating?.toUpperCase().trim();if(bbb)t.add("bbb:"+bbb.replace(/[^A-F+-]/g,"").slice(0,2));
 if((p?.reputation?.lawsuits?.length||0)>0)t.add("lawsuit");
 if((p?.reputation?.regulatory?.length||0)>0)t.add("regulatory");
 const net=network||p?.network?.name||p?.network?.parent;if(net)t.add("network:"+net);
 const risks=(p?.reputation?.risks||[]).join(" ").toLowerCase();
 const pages=m?.meta?.pages||[];const personaActive=pages.filter(x=>x.persona).reduce((s,x)=>s+(x.activeAds||0),0);const allActive=pages.reduce((s,x)=>s+(x.activeAds||0),0);
 const personaPagesLive=pages.filter(x=>x.persona&&(x.activeAds||0)>0).length;
 if((allActive>0&&personaActive/allActive>=0.25)||personaPagesLive>=3||/persona (ad )?pages?|fake doctor|doctor persona|persona-driven/.test(risks))t.add("persona-ads");
 if(/impostor|clone/.test(risks))t.add("clones");
 if(/jsdeliver/.test(risks))t.add("lookalike-script");
 if(m?.strategy?.scale)t.add("scale:"+m.strategy.scale);
 if(m?.strategy?.complianceFlags?.length)t.add("compliance-flags");
 return [...t];
}

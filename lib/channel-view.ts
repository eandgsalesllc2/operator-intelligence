// One list of every channel a brand shows up in, merging what we measured (live ads, posts, emails, marketplace
// links) with what the storefront has installed (pixels and vendor tags) and what web research mentioned.
// "live" = activity seen; "tag" = tracking installed, which shows intent but not current spend; "mention" = research only.
import type {Marketing} from "./profile";
import {GROUP_OF,type ChannelGroup} from "./channel-signatures";

export type ChannelStatus="live"|"tag"|"mention";
export type ChannelRow={name:string;group:ChannelGroup|"Other";status:ChannelStatus;evidence:string[]};
export const GROUP_ORDER:(ChannelGroup|"Other")[]=["Paid social","Search & shopping","Programmatic & native","TV & audio","Organic social","Email & SMS","Affiliate & influencer","Direct mail","Marketplaces","Other"];
const RANK:Record<ChannelStatus,number>={live:3,tag:2,mention:1};
const n=(v?:number|null)=>v!=null?v.toLocaleString("en-US"):"?";

// Keywords that map a research "channel" phrase onto a row.
const ALIASES:[RegExp,string][]=[
 [/meta|facebook|instagram ads/i,"Meta (Facebook/Instagram)"],[/tiktok/i,"TikTok"],[/pinterest/i,"Pinterest"],[/snap/i,"Snapchat"],[/reddit/i,"Reddit"],
 [/google|youtube|search|shopping|pmax|performance max/i,"Google Ads / YouTube"],[/bing|microsoft/i,"Microsoft Ads (Bing)"],[/applovin/i,"AppLovin"],
 [/newsbreak/i,"NewsBreak"],[/smartnews/i,"SmartNews"],[/mgid/i,"MGID"],[/revcontent/i,"Revcontent"],[/yahoo/i,"Yahoo DSP / Native"],[/quora/i,"Quora"],[/nextdoor/i,"Nextdoor"], [/taboola/i,"Taboola"],[/outbrain/i,"Outbrain"],[/native/i,"Native ads"],[/\bctv\b|connected tv|streaming tv|\btv\b/i,"Connected TV"],[/podcast|audio|radio/i,"Podcasts / audio"],
 [/sms|text/i,"SMS"],[/email/i,"Email"],[/affiliate/i,"Affiliates"],[/influencer|creator|ugc/i,"Influencers"],[/referral/i,"Referrals"],[/direct mail|mailer/i,"Direct mail"],
 [/amazon/i,"Amazon"],[/walmart/i,"Walmart"],[/retail|target|costco|sephora|ulta/i,"Retail"],[/twitter|\bx\b/i,"X (Twitter)"],[/linkedin/i,"LinkedIn"],
];
const EXTRA_GROUP:Record<string,ChannelGroup>={"TikTok organic":"Organic social","Instagram organic":"Organic social",Amazon:"Marketplaces",Walmart:"Marketplaces",Retail:"Marketplaces","Native ads":"Programmatic & native"};

export function channelRows(m?:Marketing|null,amazonSellers?:string[]|null):ChannelRow[]{
 const rows=new Map<string,ChannelRow>();
 const add=(name:string,status:ChannelStatus,ev:string)=>{
  const r=rows.get(name)||{name,group:GROUP_OF[name]||EXTRA_GROUP[name]||"Other",status,evidence:[]};
  if(RANK[status]>RANK[r.status])r.status=status;if(!r.evidence.includes(ev))r.evidence.push(ev);rows.set(name,r);
 };
 const meta=m?.meta;
 if(meta?.activeAds)add("Meta (Facebook/Instagram)","live",`${n(meta.activeAds)} active ads (BrandSearch)`);
 else if(meta?.totalAds)add("Meta (Facebook/Instagram)","mention",`${n(meta.totalAds)} ads all-time, none active now (BrandSearch)`);
 const lp=m?.landing?.landingPages||[];
 const metaLp=lp.filter(l=>l.status!=="inactive").reduce((s,l)=>s+(l.activeAds||0),0);
 if(metaLp)add("Meta (Facebook/Instagram)","live",`${n(metaLp)} active ads with landing pages (Atria)`);
 if(m?.tiktok?.posts)add("TikTok organic","live",`${n(m.tiktok.posts)} posts, ${n(m.tiktok.plays)} plays (BrandSearch)`);
 if(m?.instagram?.posts)add("Instagram organic","live",`${n(m.instagram.posts)} posts (BrandSearch)`);
 if(m?.email?.total){const recent=m.email.lastSent&&Date.now()-new Date(m.email.lastSent).getTime()<90*864e5;add("Email",recent?"live":"mention",`${n(m.email.total)} emails captured${m.email.lastSent?`, last ${m.email.lastSent.slice(0,10)}`:""} (BrandSearch)`)}
 for(const l of lp){if(l.kind!=="marketplace"||!l.host)continue;const mk=/amazon|amzn/.test(l.host)?"Amazon":/walmart/.test(l.host)?"Walmart":"Retail";add(mk,"live",`Ads link to ${l.host} (Atria)`)}
 for(const s of amazonSellers||[])add("Amazon","live",`Amazon seller: ${s}`);
 for(const s of m?.channelScan?.signals||[])add(s.channel,"tag",`${s.vendor} installed${s.where==="gtm"?" (via Tag Manager)":" on the site"}`);
 for(const c of m?.strategy?.channels||[]){const hit=ALIASES.find(([re])=>re.test(c));add(hit?hit[1]:c,"mention",`Research: “${c}”`)}
 return [...rows.values()].sort((a,b)=>GROUP_ORDER.indexOf(a.group)-GROUP_ORDER.indexOf(b.group)||RANK[b.status]-RANK[a.status]||a.name.localeCompare(b.name));
}

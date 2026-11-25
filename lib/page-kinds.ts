// Landing-page types and their labels; safe to import in client components (lib/page-type.ts does the classifying).
export type PageKind="product"|"listicle"|"advertorial"|"quiz"|"offer_lp"|"collection"|"home"|"checkout"|"marketplace"|"external";
export const PAGE_KIND_LABEL:Record<string,string>={product:"PDP",listicle:"listicle",advertorial:"advertorial",quiz:"quiz",offer_lp:"sales / offer page",collection:"collection",home:"homepage",checkout:"checkout",marketplace:"marketplace",external:"off-site"};

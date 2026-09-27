// Category taxonomy: "Vertical · Category". Shared by the UI, research and imports.
export const CATEGORIES=[
 "Supplements · Vitamins & general wellness",
 "Supplements · Metabolic & weight management",
 "Supplements · Beauty from within (collagen, hair/skin/nail)",
 "Supplements · Women's health (menopause, feminine, fertility, prenatal)",
 "Supplements · Men's health & performance",
 "Supplements · Sports nutrition & protein",
 "Supplements · Hydration & energy",
 "Supplements · Gut & digestive health",
 "Supplements · Sleep, mood & cognition",
 "Supplements · Lymphatic, detox & cleanse",
 "Supplements · Joint, pain & mobility",
 "Supplements · Longevity & cellular health",
 "Supplements · Kids' nutrition",
 "Supplements · Retailer / multi-brand store",
 "Botanicals · Hemp, CBD & THC",
 "Botanicals · Kratom, kava & herbal remedies",
 "Health devices · Hearing, sleep & respiratory",
 "Health devices · Recovery, fitness & EMS",
 "Health devices · Light therapy & red light",
 "Oral care · Teeth, gums & whitening",
 "Beauty · Skincare",
 "Beauty · Anti-aging & peptides",
 "Beauty · Acne & problem skin",
 "Beauty · Hair care & hair growth",
 "Beauty · Makeup & cosmetics",
 "Beauty · Lashes & brows",
 "Beauty · Fragrance",
 "Beauty · Body care, bath & soap",
 "Beauty · Sun care & self-tanning",
 "Beauty · Hair removal",
 "Beauty · Beauty devices",
 "Grooming · Shaving & men's grooming",
 "Intimate · Sexual & intimate wellness",
 "Home · Household & laundry",
 "Food & drink · Functional food & beverage",
 "Apparel · Clothing & shapewear",
 "Other · Other"
] as const;
export type Category=typeof CATEGORIES[number];
export const UNCATEGORIZED="Uncategorized";
export const verticalOf=(c:string)=>c.includes(" · ")?c.split(" · ")[0]:UNCATEGORIZED;
export const labelOf=(c:string)=>c.includes(" · ")?c.split(" · ")[1]:c||UNCATEGORIZED;
export const isCategory=(c:unknown):c is Category=>typeof c==="string"&&(CATEGORIES as readonly string[]).includes(c);

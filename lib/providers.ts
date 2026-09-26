import {NodeType} from "./types";

export type ProviderFinding={
 title:string;
 url:string;
 publisher:string;
 snippet:string;
 sourceType:"first_party"|"registry"|"trademark"|"web";
 entities:Array<{type:NodeType;label:string;subtitle:string}>;
 claims:Array<{from?:string;to?:string;label:string;claim:string}>;
};

export interface ResearchProvider{
 name:string;
 supports(seedType:NodeType):boolean;
 search(seedValue:string,seedType:NodeType):Promise<ProviderFinding[]>;
}

export const providerNames=["website","search","trademark","registry"] as const;

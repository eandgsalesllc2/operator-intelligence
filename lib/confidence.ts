import {Confidence,NodeType} from "./types";

export type ResearchSignals={
  firstParty?:boolean;
  officialRegistry?:boolean;
  independentSources?:number;
  directIdentifierMatch?:boolean;
  singleCorrelation?:boolean;
};

export function confidenceFromSignals(input:ResearchSignals):Confidence{
  if(input.firstParty&&input.officialRegistry)return "confirmed";
  if(input.officialRegistry&&input.directIdentifierMatch)return "confirmed";
  if((input.independentSources||0)>=2&&input.directIdentifierMatch)return "strong";
  if(input.singleCorrelation)return "correlation";
  return "lead";
}

export function normalizeEntity(type:NodeType,value:string){
  let v=value.trim();
  if(type==="domain")v=v.toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0];
  if(type==="email")v=v.toLowerCase();
  if(type==="phone")v=v.replace(/[^\d+]/g,"");
  return v;
}

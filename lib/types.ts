export type Confidence="confirmed"|"strong"|"correlation"|"lead"|"excluded";
export type NodeType="brand"|"person"|"company"|"trademark"|"domain"|"address"|"phone"|"email";
export type IntelNode={id:string;label:string;type:NodeType;subtitle:string;x:number;y:number;confidence:Confidence;details:string[]};
export type Edge={from:string;to:string;label:string;confidence:Confidence};
export type Evidence={id:string,title:string,source:string,confidence:Confidence,note:string};
export type TimelineItem={date:string;title:string;body:string};
export type Case={id:string,name:string,domain:string,status:string,summary:string,nodes:IntelNode[],edges:Edge[],evidence:Evidence[],timeline:TimelineItem[],openQuestions:string[]};
export type InvestigationDraft={name:string;domain:string;seedType:NodeType;notes:string};

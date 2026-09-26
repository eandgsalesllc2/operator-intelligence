import {NodeType} from "./types";

export type ResearchJobStatus="queued"|"running"|"completed"|"failed";
export type ResearchJob={
 id:string;
 investigation_id:string;
 seed_entity_id?:string|null;
 seed_value:string;
 seed_type:NodeType;
 status:ResearchJobStatus;
 depth:number;
 max_depth:number;
 provider:string;
 progress:number;
 message:string;
 error:string;
 created_at?:string;
 updated_at?:string;
};
export type ResearchSource={
 id:string;
 investigation_id:string;
 research_job_id?:string|null;
 url:string;
 title:string;
 source_type:string;
 publisher:string;
 retrieved_at?:string;
 snippet:string;
 metadata:Record<string,unknown>;
};

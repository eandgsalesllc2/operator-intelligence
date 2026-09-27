-- Saving an investigation replaces its entities, relationships and evidence.
-- Research tables must not block that: a job's seed entity is cleared, and
-- evidence links follow the rows they point at.
alter table oi_research_jobs drop constraint if exists oi_research_jobs_seed_entity_id_fkey,
  add constraint oi_research_jobs_seed_entity_id_fkey foreign key (seed_entity_id) references entities(id) on delete set null;
alter table oi_evidence_links drop constraint if exists oi_evidence_links_entity_id_fkey,
  add constraint oi_evidence_links_entity_id_fkey foreign key (entity_id) references entities(id) on delete cascade;
alter table oi_evidence_links drop constraint if exists oi_evidence_links_relationship_id_fkey,
  add constraint oi_evidence_links_relationship_id_fkey foreign key (relationship_id) references relationships(id) on delete cascade;
alter table oi_evidence_links drop constraint if exists oi_evidence_links_evidence_id_fkey,
  add constraint oi_evidence_links_evidence_id_fkey foreign key (evidence_id) references evidence(id) on delete cascade;

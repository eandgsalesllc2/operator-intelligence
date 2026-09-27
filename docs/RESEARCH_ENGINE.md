# Operator Intelligence Research Engine

## Pipeline

1. Queue a seed from a brand, domain, person, company, trademark, address, phone, or email.
2. Fan the seed out to provider adapters.
3. Store raw provider findings before accepting any conclusion.
4. Normalize and deduplicate discovered identifiers.
5. Convert supported findings into entities, relationships, evidence, sources, and evidence links.
6. Score confidence from evidence quality and independent convergence.
7. Queue newly discovered pivots until max depth or a duplicate is reached.
8. Keep ambiguous correlations as leads rather than ownership claims.

## What runs today

`POST /api/research` with `{seedValue, seedType?, name?, investigationId?, seedEntityId?}` creates the investigation if needed, queues a job and returns 202. The job runs after the response (`after()`, 300 s limit) and the dashboard polls `GET /api/research?jobId=`. A run that collects nothing is marked failed.

| Provider | Needs | Seeds | What it adds |
|---|---|---|---|
| Portfolio | database | all | Entities in other investigations matching the seed, then matching the companies, people and emails the site names |
| First-party | — | domain (or email on a company domain) | Legal entities (d/b/a, "operated by", copyright), emails, phones, addresses (mass registered-agent addresses flagged), tracking IDs, Shopify store, checkout vendors, funnel subdomains |
| RDAP | — | domain | Registration date, registrar, registrant org when not redacted |
| Wayback | — | domain | First archived capture |
| crt.sh | — | domain | Funnel/checkout subdomains from certificate logs |
| Claude web research | `ANTHROPIC_API_KEY` | all | Web search + fetch across trademarks, registries, press, complaints and dockets, structured into nodes, edges, evidence and timeline with confidence labels |

To turn on web research, add `ANTHROPIC_API_KEY` to the Vercel project (Production and Preview) and redeploy. Each run uses Claude Opus 5 with up to 14 searches and 14 page fetches.

All outbound fetches go through `lib/net.ts`, which resolves the host, rejects private, loopback, link-local and metadata addresses, blocks credentials and odd ports, and re-validates every redirect.

## Provider contract

Providers return source URL, publisher, snippet, source type, discovered entities, and explicit claims. Provider output is staged in oi_provider_findings before it can modify the investigation graph.

Planned adapters:
- First-party website / legal policies
- Web search
- Trademark registries
- Corporate registries
- Domain / historical infrastructure
- Merchant descriptor sources
- Public professional / hiring evidence

## Confidence rules

Confirmed requires direct documentary evidence or converging first-party + official records.
Strong requires multiple independent sources plus a direct identifier match.
Correlation is used for shared infrastructure or a single non-dispositive overlap.
Lead is an unresolved pivot.
Excluded records disproven associations.

Registered agents, attorneys, accountants, warehouses, mailboxes, shared VoIP numbers, templates, and geographic proximity never establish ownership by themselves.

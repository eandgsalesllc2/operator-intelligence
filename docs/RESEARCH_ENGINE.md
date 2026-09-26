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

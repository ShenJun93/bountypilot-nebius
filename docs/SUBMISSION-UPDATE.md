# BountyPilot — Prize Optimization Submission Update

Local draft only. This does not change the current Devpost submission until an explicit external edit is performed.

## Positioning

BountyPilot is a persistent Alexa+ opportunity operator for independent builders. It does not stop at deciding whether a bounty is worth pursuing: it keeps a durable queue, tracks lifecycle state, preserves blockers, and turns the queue into a daily execution brief.

## New judge-facing capability

Daily Briefing answers: "What should I work on today?"

It returns up to three active opportunities with fit score, lifecycle status, reward/deadline evidence, the first unresolved blocker or unknown, and one concrete next action. Actionable work is ranked ahead of already-submitted work.

The conversation layer calls the real daily_briefing MCP tool and renders a dedicated briefing card.

## Alexa+ / MCP update

Local candidate now exposes 8 coherent MCP tools:
- analyze_opportunity
- save_opportunity
- get_opportunity_queue
- compare_opportunities
- build_submission_plan
- set_opportunity_status
- daily_briefing
- next_best_action

The same tool surface is used by the web simulator through the official SDK and by external clients through Streamable HTTP. Final reviewed candidate verification is complete: `node --test` is **23/23 PASS**, `scripts/mcp-smoke.mjs` reports schema `bountypilot-smoke/v2` with **8/8 tools**, protocol `2026-07-28`, analyzer `GO / 98`, and `pass: true`. `mcp-protocol-proof` v0.2 independently generated `docs/receipts/mcp-protocol-proof-v0.2-local.json` with the same eight-tool PASS. A fresh pre-promotion production run using canonical verifier candidate `411869d...` is captured in `docs/receipts/production-pre-promotion-2026-10-05.json`: production still negotiates `2026-07-28` but exposes **7 tools**, with `daily_briefing` as the only missing candidate tool and expected verifier exit `2`. Production must be re-verified after deployment before any 8-tool claim is copied into Devpost.

## Open Source Mini Challenge update

mcp-protocol-proof v0.2 upgrades the companion project from a one-off verifier into a CI-oriented compatibility proof tool.

v0.2 adds bounded timeouts, deterministic receipt schema `mcp-protocol-proof/v1`, `--output` JSON artifact support, stable exit codes, missing-tool checks, a GitHub Actions recipe, and failure-path tests. The original nested prototype `03a96cf` is superseded. The canonical public-history candidate is `E:\\Projects\\mcp-protocol-proof-public-v0.2`, branch `work/mcp-protocol-proof-v0.2-public`, commit `411869d9d57604fbb26119ff6002f392326920f6`, based directly on submitted public commit `ecd8552c...`, with **7/7 tests PASS**.

The v0.2 branch is now public. Candidate contribution commit URL: https://github.com/ShenJun93/mcp-protocol-proof/commit/cb6e96c58b76e39df7e260bcba6775295b99f954 . Do not replace the submitted Devpost URL until the edit is previewed and explicitly approved.

## AWS Builder Mini Challenge

Organizer rules explicitly say Kiro Crew qualifies on its own as a development tool when the integration/use is documented.

Current state: **QUALIFIED LOCALLY / DEVPOST CLAIM NOT YET UPDATED.**

Kiro Crew v0.7.2 was used for a genuine documented TaskRunner workflow. The run completed **11/11 tasks PASS**, produced a reviewed reliability improvement, and the final BountyPilot suite passes **23/23**. This now supports the AWS Builder claim; Devpost must still be explicitly edited before the claim becomes public.

## Friction-log audit

The existing submission pack contains three detailed friction logs, but the current receipt only proves the source document URL was supplied. Before editing Devpost, verify whether all three structured friction-log entries are actually present in the submission fields.

## Updated demo story

1. problem + Daily Briefing;
2. multi-tool listing triage;
3. persistence after reload/new session;
4. SKIP guardrail contrast;
5. MCP proof / 8-tool runtime evidence;
6. close on persistent Alexa+ workflow, not one-shot Q&A.

## External update gates

- [x] Kiro Crew evidence complete before AWS Builder claim.
- [x] Candidate preview deployed and authenticated preview smoke shows 8 tools.
- [ ] Production promotion + production smoke shows 8 tools.
- [x] mcp-protocol-proof v0.2 pushed publicly on `work/mcp-protocol-proof-v0.2-public`; public tip `cb6e96c58b76e39df7e260bcba6775295b99f954`.
- [ ] Updated demo reviewed and published.
- [ ] Friction-log fields audited in Devpost.
- [ ] Devpost edit preview checked.
- [ ] Explicit final approval before saving/publishing the edited submission.

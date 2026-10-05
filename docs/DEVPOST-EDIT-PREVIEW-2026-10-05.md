# Devpost Edit Preview — BountyPilot — 2026-10-05

**LOCAL PREVIEW ONLY — DO NOT SAVE TO DEVPOST WITHOUT EXPLICIT APPROVAL**

## Keep unchanged

- Project title: **BountyPilot**
- Primary track: **Alexa+**
- Primary repo: https://github.com/ShenJun93/bountypilot-amazon-2026
- Current production URL may remain listed, but do not describe it as the eight-tool build until production is actually promoted and re-verified.

## Track / prize selections

- Alexa+: **Yes / primary**
- AWS Builder: **Yes**
  - basis: genuine Kiro Crew v0.7.2 TaskRunner workflow completed **11/11 PASS**
  - evidence: `docs/KIRO-CREW-EVIDENCE.md`
- Open Source: **Yes**
  - repo: https://github.com/ShenJun93/mcp-protocol-proof
  - proposed contribution commit:
    https://github.com/ShenJun93/mcp-protocol-proof/commit/cb6e96c58b76e39df7e260bcba6775295b99f954

## Suggested short description

BountyPilot is a persistent Alexa+ opportunity operator for independent builders. It analyzes bounty and hackathon listings through a self-hosted MCP workflow, preserves evidence and blockers across sessions, and turns the active queue into a Daily Briefing with one concrete next action per priority.

## Suggested judge-facing update

BountyPilot now goes beyond one-shot triage. The reviewed repository build adds **Daily Briefing**, which reads persistent opportunity state and prioritizes actionable work with reward/deadline evidence, lifecycle status, blockers, and a concrete next action. The reviewed candidate exposes eight MCP tools and passes **23/23 tests**.

Kiro Crew v0.7.2 was used in a genuine development workflow and completed **11/11 TaskRunner steps PASS**, supporting the AWS Builder mini-challenge. The open-source companion `mcp-protocol-proof` v0.2 is also public and passes **7/7 tests**.

Do **not** say the currently hosted production endpoint exposes eight tools unless production is promoted and re-verified. The repository candidate is the source of truth for the eight-tool claim.

## Open Source contribution field

Replace the currently submitted v0.1 contribution commit only after edit preview:

Old:
`ecd8552ce5b55ee71f63ed3d4f26bfcd111e62ba`

Proposed:
`cb6e96c58b76e39df7e260bcba6775295b99f954`

## Friction-log field audit

Before saving Devpost, verify all three structured entries are actually present:

1. Alexa+ preview-only tooling vs self-hosted MCP path.
2. Lack of obvious runtime proof for the minimum MCP protocol.
3. Simulation expectations / voice and UI clarification.

Do not infer presence from local docs; inspect the actual form.

## Demo / media

Preferred replacement demo: `docs/DEMO-V2.md`.

The video should prove:
- Daily Briefing in first 12 seconds;
- state persists across sessions;
- GO vs SKIP guardrail contrast;
- eight-tool candidate proof;
- no claim that current production is already the eight-tool deployment.

Do not replace the current public video until the new capture has been reviewed for audio/video correctness.

## Final save checklist

- [ ] Alexa+ remains primary.
- [ ] AWS Builder = Yes.
- [ ] Open Source = Yes.
- [ ] Open Source commit = `cb6e96c...`.
- [ ] Repo link resolves to optimized `main`.
- [ ] All three friction logs confirmed in actual form.
- [ ] Eight-tool wording refers to reviewed repository candidate, not current production.
- [ ] New video URL used only after publication + playback verification.
- [ ] Preview all links.
- [ ] Explicit approval before final Devpost save.

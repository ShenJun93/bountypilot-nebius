# Amazon Prize Optimization — External Promotion Plan

Local-only plan. No external action is authorized by this document.

## Current candidate

Primary repo:
- workspace: `E:\Projects\bountypilot-amazon-2026`
- branch: `work/amazon-prize-optimization-v1`
- current reviewed feature-branch tip before this docs-only update: `e8a3e2199d6cc612d97b665a2dc955cfb61ae8a0`
- regression: **23/23 PASS**
- local/preview MCP smoke: **8 tools / PASS**
- negotiated preview protocol: `2025-11-25` from the protected Vercel preview endpoint
- new judge-facing capability: `daily_briefing`

Open-source companion:
- public repo: `https://github.com/ShenJun93/mcp-protocol-proof`
- currently submitted Devpost contribution commit: `ecd8552ce5b55ee71f63ed3d4f26bfcd111e62ba`
- v0.2 public branch: `work/mcp-protocol-proof-v0.2-public`
- v0.2 public tip: `cb6e96c58b76e39df7e260bcba6775295b99f954`
- v0.2 tests: **7/7 PASS**
- candidate Devpost contribution URL: `https://github.com/ShenJun93/mcp-protocol-proof/commit/cb6e96c58b76e39df7e260bcba6775295b99f954`

AWS Builder:
- current Devpost choice: **No** until the submission is explicitly edited
- candidate qualification: **QUALIFIED**
- Kiro Crew v0.7.2 workflow: **completed 11/11 PASS**
- final Kiro evidence: reviewed and recorded in `docs/KIRO-CREW-EVIDENCE.md`

Official deadline currently shown by Devpost: **October 23, 2026 at 12:00 PM PDT**.

## Recommended safe promotion sequence

### Gate A — Kiro Crew — COMPLETE

1. Official Kiro Crew/CLI installed and authenticated.
2. `docs/KIRO-CREW-TASK.md` executed through Kiro Crew.
3. TaskRunner completed **11/11 PASS**.
4. Resulting code change reviewed.
5. Final BountyPilot regression: **23/23 PASS**.
6. `docs/KIRO-CREW-EVIDENCE.md` completed.
7. AWS Builder claim is now technically supported; Devpost edit remains pending explicit approval.

### Gate B — Open Source v0.2 — PUBLIC BRANCH COMPLETE

1. v0.2 is public on `work/mcp-protocol-proof-v0.2-public`.
2. Public tip: `cb6e96c58b76e39df7e260bcba6775295b99f954`.
3. 7/7 tests PASS.
4. Exact public commit URL is available.
5. Remaining action: update the Devpost Open Source contribution URL only after previewing the edit and obtaining explicit save/publish approval.

### Gate C — BountyPilot candidate — FEATURE BRANCH + PREVIEW COMPLETE

1. Public feature branch: `work/amazon-prize-optimization-v1`.
2. Latest remote tip before this docs-only update: `e8a3e2199d6cc612d97b665a2dc955cfb61ae8a0`.
3. Protected Vercel preview is READY.
4. Authenticated preview verification:
   - 8 MCP tools;
   - `daily_briefing`;
   - empty-queue briefing path;
   - GO listing save/next action;
   - daily briefing card with array `items`.
5. Remaining action: production promotion + production smoke before changing live Devpost claims from seven to eight tools.

### Gate D — Presentation

Requires explicit publication approval.

1. Capture the Demo V2 sequence.
2. Verify audio/video/media.
3. Publish updated video.
4. Capture judge-ready screenshots.

### Gate E — Devpost edit

Requires explicit Devpost-edit approval.

Before saving:
- confirm Alexa+ remains the primary track;
- mark AWS Builder = Yes;
- keep Open Source = Yes;
- replace the Open Source contribution commit with `cb6e96c...`;
- verify all 3 friction logs are present in the actual form fields;
- update 7 → 8 tools only after production proof passes;
- update video only if Gate D passes;
- preview all links and text.

## Rollback rule

If any promotion gate fails, keep the currently submitted/public version intact. Never trade a valid submitted entry for an unverified optimization.

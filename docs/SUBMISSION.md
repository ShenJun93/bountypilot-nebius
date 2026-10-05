# BountyPilot — Submission Pack

Status: **SUBMITTED / OPTIMIZED FEATURE BRANCH + PREVIEW VERIFIED / DEVPOST UPDATE NOT YET PUBLISHED.**

## Primary track

Alexa+

## Mini challenge

Open Source

## Project title

BountyPilot

## Short description

BountyPilot is a stateful MCP workflow for solo builders that triages money-making opportunities, remembers them across sessions, preserves blockers and unknowns, and returns the next concrete action.

## What it does

A user can paste a bounty or hackathon listing into the simulator. BountyPilot:

1. analyzes the opportunity against an async, code-first profile;
2. returns an explainable GO / REVIEW / SKIP decision;
3. saves the opportunity into a queue;
4. preserves reward, deadline, live-gate, pre-hire, and unknown evidence;
5. builds a concrete submission plan;
6. tracks lifecycle state such as candidate, building, submitted, won, lost, or skipped;
7. returns the next best action in a later session;
8. turns the active queue into a Daily Briefing with reward/deadline evidence, blockers, lifecycle state, and one concrete next action per priority.

This is intentionally more than a single-turn Q&A flow: the queue and status model preserve execution context across sessions and the Daily Briefing converts that state into an execution-oriented morning workflow.

## Alexa+ / MCP implementation

- Self-hosted MCP server.
- Public endpoint: https://bountypilot-amazon-2026.vercel.app/mcp
- Transport: Streamable HTTP.
- Official MCP TypeScript SDK v2.
- Negotiated production protocol version: `2026-07-28`.
- Hackathon minimum being verified against: `2025-11-25`.
- **Production currently exposes the original seven-tool surface** until the optimized candidate is deployed.
- **Local optimized candidate exposes eight MCP tools**:
  - `analyze_opportunity`
  - `save_opportunity`
  - `get_opportunity_queue`
  - `compare_opportunities`
  - `build_submission_plan`
  - `set_opportunity_status`
  - `daily_briefing`
  - `next_best_action`

The web simulator uses the same candidate tool definitions through the official MCP client and SDK `InMemoryTransport`. After deployment, the public `/mcp` endpoint must be re-verified before the Devpost copy is changed from seven to eight tools.

## Public links

- Primary repository: https://github.com/ShenJun93/bountypilot-amazon-2026
- Hosted simulator: https://bountypilot-amazon-2026.vercel.app
- MCP endpoint: https://bountypilot-amazon-2026.vercel.app/mcp

## Open Source mini challenge

Contribution type: new additional open-source project created during the hackathon window.

- Contribution repository: https://github.com/ShenJun93/mcp-protocol-proof
- Currently submitted contribution commit: https://github.com/ShenJun93/mcp-protocol-proof/commit/ecd8552ce5b55ee71f63ed3d4f26bfcd111e62ba
- Public v0.2 candidate commit: https://github.com/ShenJun93/mcp-protocol-proof/commit/cb6e96c58b76e39df7e260bcba6775295b99f954
- Primary project repository: https://github.com/ShenJun93/bountypilot-amazon-2026
- GitHub username: `ShenJun93`
- License: MIT

### What the contribution does

`mcp-protocol-proof` is a narrow CLI that performs a real MCP Streamable HTTP initialize handshake, reports the negotiated protocol version and tool list, compares the result with a required minimum protocol date, optionally checks expected tool names, and exits non-zero when the proof fails.

The live Devpost field still points to v0.1 at `ecd8552c...`, but v0.2 is now public on branch `work/mcp-protocol-proof-v0.2-public`, tip `cb6e96c58b76e39df7e260bcba6775295b99f954`. v0.2 adds bounded timeouts, stable exit codes, JSON receipt output, CI examples, and stronger failure-path tests. Replace the Devpost contribution URL only after edit preview and explicit save approval.

### Why it matters

Protocol compatibility is a runtime property. The CLI gives developers and reviewers stronger evidence than a README statement and directly addresses the practical problem of proving that a self-hosted MCP endpoint meets a minimum protocol requirement.

### Verified use against BountyPilot

**Current production truth** from the already-published build:
- minimum protocol: `2025-11-25`
- negotiated protocol: `2026-07-28`
- protocol era: `modern`
- tool count: 7
- missing required tools: 0
- result: PASS

**Optimized local candidate truth**:
- final reviewed main test suite: **23/23 PASS**;
- protocol: `2026-07-28` / `modern`;
- tool count: **8**;
- `daily_briefing` present;
- analyzer smoke: `GO / 98`;
- `bountypilot-smoke/v2`: PASS;
- independent `mcp-protocol-proof/v1` local receipt: PASS, 0 missing tools.

These local results must be repeated against production after deployment before updating the live Devpost technical claims.

## Product feedback

### MCP TypeScript SDK

**Used for:** the self-hosted MCP server, Streamable HTTP handler, in-memory simulator client/server transport, tool registration, tool discovery, and production smoke verification.

**What worked well:** the SDK made it possible to use one tool surface across a simulator and an external Streamable HTTP endpoint. Tool registration with schemas is compact, and the client exposes the negotiated protocol version after connection.

**What needs work:** compatibility proof is not obvious from the basic happy-path setup. Developers benefit from a simple documented pattern that shows the exact negotiated protocol version, the actual transport, and the discovered tool list rather than a generic “connected” state.

**Onboarding:** once the client/server packages and transport model were understood, getting to a working tool call was straightforward. The most time-consuming part was separating transport concerns from application behavior and proving what was negotiated at runtime.

**Would use again:** yes. The protocol/tool abstraction maps well to agentic workflows that need to be callable from more than one client.

### Alexa+ hackathon developer path

**Used for:** the Alexa+ primary-track architecture and submission requirements.

**What worked well:** the self-hosted MCP option allows a real integration to be built without access to preview-only Alexa+ tooling. The FAQ eventually makes this path explicit.

**What needs work:** the boundary between preview-only Alexa+ tools and tools available to hackathon participants should be prominent at the start of the Alexa+ setup path. It is easy to assume the Category SDK, MCP Toolkit, CLI, or Web Simulator are available before finding the clarification.

**Onboarding:** the open MCP route was workable once the self-hosted path was identified as the intended public route for participants without preview access.

**Would build again:** yes, especially for workflows that need persistent state and orchestration across several actions.

### Vercel

**Used for:** public hosting of the Express app and Streamable HTTP MCP endpoint.

**What worked well:** once the root Express entrypoint matched Vercel's runtime detection, the app and MCP endpoint deployed together and could be smoke-tested remotely.

**What needs work:** serverless `/tmp` storage is ephemeral, so hosted persistence needs an external durable store for production use.

**Onboarding:** deployment required one entrypoint adaptation, then the runtime was stable.

**Would use again:** yes for a public demo and stateless MCP hosting; for durable state I would pair it with a database.

## Friction logs

### Friction 1 — Preview-only Alexa+ tooling looked like part of the participant path

- Task attempted: determine which Alexa+ SDK/toolkit/simulator should be used for a hackathon entry.
- Steps taken: reviewed Alexa+ setup material, hackathon resources, FAQs, and track requirements.
- Expected: a directly accessible Alexa+ developer toolkit or simulator.
- Actual: preview-only Category SDK, MCP Toolkit, CLI, and Web Simulator are not available to general hackathon participants.
- Severity: Medium.
- Workaround: use the explicitly permitted self-hosted MCP route plus a custom web simulator.
- Suggestion: place a hackathon-specific banner at the top of Alexa+ setup guidance stating which tools are preview-only and linking immediately to the self-hosted MCP path.

### Friction 2 — No obvious runtime proof for the minimum MCP protocol requirement

- Task attempted: prove the production endpoint meets the minimum MCP protocol version.
- Steps taken: connected with the official MCP client, inspected the negotiated protocol version, listed tools, and built a reusable validator.
- Expected: a simple official conformance command or documented verification recipe.
- Actual: the application could work while still leaving the exact negotiated version implicit unless the client inspection API was used.
- Severity: Medium.
- Workaround: created the open-source `mcp-protocol-proof` CLI.
- Suggestion: publish an official one-command compatibility check that reports negotiated protocol version, transport, and discovered tool count.

### Friction 3 — Simulation expectations needed clarification

- Task attempted: determine how closely a web-based Alexa+ simulation must resemble a real Alexa+ UI and whether voice is required.
- Steps taken: checked rules, FAQ, and organizer forum clarification.
- Expected: a concise simulator acceptance checklist in the track requirements.
- Actual: the rules allow simulation, but details such as voice requirement and custom UI flexibility required clarification.
- Severity: Low.
- Workaround: used a high-quality custom web UI and a real MCP backend/tool surface; voice input/output is not required for the simulation.
- Suggestion: add a short checklist covering voice, visual fidelity, custom UI, and what the demo video should prove.

## Verification receipts

- Existing production MCP negotiated protocol: `2026-07-28`.
- Existing production tool surface: 7 tools.
- Existing production `analyze_opportunity`: GO, score 98 on the smoke fixture.
- Optimized candidate unit/integration tests: **23/23 PASS**.
- Optimized local MCP smoke: **8/8 tools / PASS**.
- Local verifier v0.2 tests: **7/7 PASS**.
- Local verifier receipt: `docs/receipts/mcp-protocol-proof-v0.2-local.json`.
- Public GitHub primary repo license: MIT detected.
- Public GitHub Open Source companion repo license: MIT detected.

## Current submission state and remaining optimization gates

The Devpost entry is already submitted as submission **1204416**. The following are candidate improvements, not completed public actions:

- [x] Build and test Daily Briefing locally.
- [x] Prepare judge-first Demo V2 script.
- [x] Prepare v0.2 of `mcp-protocol-proof` locally.
- [x] Harden local MCP smoke to require all eight tools.
- [x] Publish v0.2 on public branch `work/mcp-protocol-proof-v0.2-public`; tip `cb6e96c...`.
- [x] Run genuine Kiro Crew v0.7.2 workflow and capture evidence; TaskRunner completed 11/11 PASS.
- [x] Publish optimized BountyPilot feature branch and verify protected preview with 8 MCP tools.
- [ ] Re-run production smoke and verifier against the deployed eight-tool endpoint.
- [ ] Capture/publish updated demo under explicit approval.
- [ ] Audit all three friction logs in the actual Devpost fields.
- [ ] Preview and explicitly approve any Devpost edit before saving.

AWS Builder qualification is now supported by documented Kiro Crew usage, and the optimized feature branch/Open Source v0.2 branch are public. Production promotion, updated video publication, and Devpost edits are still not claimed or performed.

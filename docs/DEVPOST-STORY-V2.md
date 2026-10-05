# BountyPilot — Devpost Story V2

> LOCAL PREVIEW ONLY. Do not save to Devpost without explicit approval.

## Short description

BountyPilot is a persistent Alexa+ opportunity operator for solo builders: it triages bounties and hackathons, remembers the pipeline across sessions, surfaces blockers, and turns saved state into a Daily Briefing with one concrete next action per priority.

## Inspiration

I build solo and regularly evaluate bounties, hackathons, grants, and paid issues. The hard part is often not coding — it is deciding what is actually worth doing.

A promising listing can hide a mandatory interview, a pre-hire gate, an unclear deadline, or a missing submission path. Even after checking all of that, I still have to remember what I already reviewed and what the next action is.

BountyPilot is the assistant I wanted for that workflow: ask once, keep the whole opportunity pipeline moving.

## What it does

BountyPilot is an Alexa+ style assistant backed by a self-hosted MCP server.

### Evidence-first triage

Attach a listing and ask whether it is worth building. BountyPilot extracts:

- reward;
- deadline;
- code/repository/demo submission path;
- live-interview gates;
- pre-hire requirements;
- important unknowns.

It returns **GO**, **REVIEW**, or **SKIP** with the evidence behind the decision instead of hiding the reasoning in a black box.

### Persistent queue

Every analyzed opportunity becomes durable workflow state.

- GO/REVIEW items stay actionable.
- SKIP items are filed as skipped so they are not suggested again.
- Status can move through candidate, building, submitted, won, or lost.
- Open a new session and BountyPilot still knows where you left off.

### Daily Briefing

The reviewed repository candidate adds an eighth MCP tool: `daily_briefing`.

Ask:

> What should I work on today?

BountyPilot reads the persistent queue and returns the highest-value actionable work with:

- fit score;
- lifecycle status;
- reward/deadline evidence;
- blocker;
- one concrete next action.

This is the core product shift from one-shot Q&A to a persistent Alexa+ workflow.

### Planning and execution

BountyPilot can also:

- compare opportunities;
- generate a submission plan;
- update lifecycle status;
- select the next best action.

The web simulator shows the MCP tool trace for each turn so the workflow remains inspectable.

## How we built it

### Self-hosted MCP

BountyPilot uses the official MCP TypeScript SDK and Streamable HTTP at `/mcp`.

The reviewed candidate exposes eight tools:

1. `analyze_opportunity`
2. `save_opportunity`
3. `get_opportunity_queue`
4. `compare_opportunities`
5. `build_submission_plan`
6. `set_opportunity_status`
7. `next_best_action`
8. `daily_briefing`

The simulator is itself an MCP client. It does not bypass the protocol and call the data store directly.

### State

Hosted state uses Redis/Upstash over REST with browser-isolated workspaces. Local development falls back to a JSON state file.

### Explainable decisions

The decision layer is deliberately rule-based:

- no paid model API is required;
- every score change is inspectable;
- missing facts remain explicit unknowns.

### Protocol proof

I also created an open-source companion project, `mcp-protocol-proof`, which performs a real MCP initialize handshake, verifies a minimum protocol version, lists tools, and emits a machine-readable receipt.

The public v0.2 contribution is:

https://github.com/ShenJun93/mcp-protocol-proof/commit/cb6e96c58b76e39df7e260bcba6775295b99f954

### Kiro Crew / AWS Builder

Kiro Crew v0.7.2 was used in a genuine development workflow during the hackathon.

A documented TaskRunner workflow completed **11/11 tasks PASS**, produced a reviewed frontend reliability improvement, and the final BountyPilot regression suite passes **23/23 tests**.

Evidence is recorded in:

`docs/KIRO-CREW-EVIDENCE.md`

## Challenges we ran into

### Proving protocol compatibility

A UI badge that says “connected” is not proof. The protocol-proof companion project exists because the negotiated MCP version and tool surface should be independently verifiable.

### Durable state on serverless infrastructure

The first hosted build used serverless temporary storage, which undermined the entire “remember across sessions” idea.

Moving to Redis exposed two additional integration issues:

- Vercel’s integration-prefixed environment variables did not match the first credential lookup;
- immediate reads after writes needed the Upstash sync token for read-your-writes behavior.

Both were reproduced and fixed before acceptance.

### Alexa+ developer-tool access

Several gated Alexa+ add-on tools are not generally available to hackathon participants. The self-hosted MCP route plus a web-based Alexa+ simulation is therefore intentional and follows the hackathon’s documented participant path.

### Fail-soft rendering

A malformed briefing card should not break the whole simulator. Kiro Crew helped identify and harden this boundary so missing or malformed briefing items degrade safely.

## Accomplishments that we're proud of

- A genuinely stateful workflow instead of a single-turn chatbot.
- A Daily Briefing that converts memory into action.
- Eight MCP tools in the reviewed repository candidate.
- **23/23** BountyPilot tests passing.
- A public protocol-proof companion project with **7/7** tests.
- A documented Kiro Crew workflow with **11/11** TaskRunner steps passed.
- Explicit GO/REVIEW/SKIP guardrails for solo-builder constraints.
- An inspectable MCP tool trace for every simulated Alexa+ interaction.

## What we learned

For real work, memory and explicit uncertainty matter more than clever wording.

“The deadline is not stated” is better than guessing.

A useful agent also needs to know what happens next. Persisting the queue was important, but turning that state into a Daily Briefing made the product feel operational rather than merely conversational.

## What's next for BountyPilot

- liveness checks that detect closed or expired opportunities;
- optional evidence-quoting extraction for messy listings;
- notifications when a deadline or submission state changes;
- packaging as an Alexa+ Agent Skill if broader participant access becomes available.

## Submission truth to preserve

- Primary track: Alexa+.
- AWS Builder: supported by documented Kiro Crew usage.
- Open Source: supported by public `mcp-protocol-proof` v0.2 contribution.
- The reviewed repository candidate has eight tools.
- Do **not** claim the currently published production endpoint has eight tools until production is actually promoted and re-verified.

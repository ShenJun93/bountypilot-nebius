# BountyPilot

BountyPilot is a self-hosted Model Context Protocol server plus a web-based Alexa+ simulation built for the **Amazon Developer Hackathon 2026 — Alexa+ track**.

It turns bounty hunting into a stateful agent workflow instead of a one-shot Q&A:

1. analyze an opportunity against an async, code-first profile;
2. save it to a persistent queue;
3. compare opportunities without hiding blockers;
4. build a concrete submission plan;
5. track progress across sessions;
6. ask for the next best action;
7. get a daily priority briefing across the active queue.

The simulator invokes the same eight MCP tools through the official SDK using an in-memory MCP transport. The separately exposed `/mcp` route serves the same tool surface over Streamable HTTP for external clients and Alexa+ integration.

## The Alexa+ simulation

The web simulator is a multi-turn conversation, not a form:

- "Alexa, open BountyPilot" — on a returning visit it greets you with your saved pipeline and the next step.
- Attach a listing and ask "is this worth building?" — it analyzes, saves, and (for SKIP) files the listing as skipped on its own, then tells you what to do next.
- "What should I work on today?", "What's in my queue?", "Plan my top opportunity", "I submitted it" — each maps to a short chain of MCP tool calls.

Replies are read aloud with the browser's built-in speech synthesis (toggle in the header), and results come back as cards: a verdict card, a daily briefing card, a plan card, and a queue carousel. Every turn shows the MCP tool calls it made.

Intent routing (`src/conversation.js`) is rule-based on purpose: every decision is explainable and the demo needs no paid model API.

## Track technology

- Self-hosted MCP server
- Streamable HTTP endpoint: `/mcp`
- MCP TypeScript SDK v2
- Verified negotiated protocol version: `2026-07-28` (newer than the hackathon minimum `2025-11-25`)
- Web simulator uses an MCP client over the SDK's in-memory transport; it does not bypass the MCP tool layer
- Public `/mcp` uses Streamable HTTP and exposes the same eight tools

## Run

```bash
npm install
npm start
```

Open `http://127.0.0.1:4310`.

## Verify MCP

With the server running:

```bash
npm run smoke
```

The smoke client performs a real initialize handshake, requires the full eight-tool surface, calls `analyze_opportunity` and `daily_briefing`, and exits non-zero if protocol/tool/runtime checks fail.

## Tools

- `analyze_opportunity`
- `save_opportunity`
- `get_opportunity_queue`
- `compare_opportunities`
- `build_submission_plan`
- `set_opportunity_status`
- `daily_briefing`
- `next_best_action`

## State

Each browser gets its own workspace id (kept in `localStorage`), so visitors never see each other's queue. External MCP clients pass an optional `workspace` argument; without it they use `default`.

Storage is chosen from the environment, in this order:

| Environment | Storage | Survives restarts |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or the Vercel Upstash integration's `…KV_REST_API_URL` + `…KV_REST_API_TOKEN` (any prefix, e.g. `kv_KV_REST_API_URL`) | Redis over REST | yes |
| `BOUNTYPILOT_STATE=/path/state.json` | that file | yes |
| running on Vercel with neither | function `/tmp` | no — may reset on a cold start |
| local default | `data/state.json` (ignored by Git) | yes |

`GET /health` reports which one is active, and the simulator shows it in the header. Files written by v0.1 (a single top-level queue) are read as the `default` workspace.

## Privacy and cost

The current proof of concept uses no paid model API and sends no listing text to a third-party model. State is local to the self-hosted server.

## License

MIT.

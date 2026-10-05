# BountyPilot

**Is this bounty worth building, and is it still open? Answers you can check, quote by quote.**

BountyPilot is an opportunity triage agent for solo developers who hunt bounties and hackathons.
Paste a listing and it tells you GO, REVIEW or SKIP, and if the listing has a link it checks the
source to see whether the opportunity already closed or someone else took it. Your queue is
remembered across sessions.

Built for the **Nebius × NVIDIA Global AI Hackathon** — *Best Apps and Agents* track.

## Why

Most of the time spent on bounties is not building, it is triage: is it still open, does it need a
live interview, do I have to be hired first, is someone already working on it. Summaries and
aggregators go stale — the AnySearch bounty list still reads as open while its linked claim sheet
shows every project taken, and a $1,500 GitHub bounty looked free until the API showed it was
assigned. BountyPilot checks the canonical source and shows its evidence.

## How it uses Nebius Token Factory and NVIDIA Nemotron

- **Listing extraction.** Each listing is sent to **`nvidia/nemotron-3-super-120b-a12b`** on
  **Nebius Token Factory** (OpenAI-compatible `/v1/chat/completions`, `response_format: json_schema`).
  Nemotron returns reward, deadline, live-interview gate, pre-hire gate, unpaid wording, submission
  path and eligibility — and **each field must carry a quote copied from the listing**.
- **Every quote is verified.** `src/extractor.js` checks that each quote appears verbatim in the
  listing (case and whitespace normalized). Fields whose quote is not found are discarded and
  reported in the card ("2 unquoted fields discarded"). Nemotron cannot invent a fact into a verdict.
- **The rules stay the guardrail.** A rule engine (`src/analyzer.js`) runs on every listing. A
  verified Nemotron field may *add* a blocker or fill a missing reward/deadline, but it can never
  clear a blocker the rules found. Example: the rules do not know that "Finalists present their
  project on a video call with the judges" is a live gate; Nemotron finds and quotes it, and the
  verdict becomes SKIP with that sentence in the reply.
- **Page verdicts.** When a listing page has neither "closed" nor "open" wording the rules can match,
  Nemotron reads the page and must again quote it; an unquoted answer is ignored and the status stays
  UNKNOWN.

Measured on the live API (2026-10-05): one triage is a single Token Factory call of ~300 prompt and
~1.4k completion tokens (most of them reasoning), about 7 seconds end to end.

## How it uses Tavily

`check_liveness` answers "is it still open?" from the canonical source:

| Link | Check |
|---|---|
| GitHub issue / PR | GitHub REST API: closed, assignees (ignored on *Help Wanted* issues, where repos like Expensify assign their own staff), linked open pull requests, comment load |
| Any other page | **Tavily Extract** reads the page; rules look for closed / claimed / open wording and quote the sentence; Nemotron is the quoted fallback. **Tavily Search** looks for related work by title |

Statuses: `OPEN`, `CLOSED`, `CLAIMED`, `CONTESTED`, `UNKNOWN`. A page that merely lacks "closed"
wording is `UNKNOWN`, not `OPEN`. During triage, a listing whose link is `CLOSED` or `CLAIMED` is
filed as skipped automatically.

## Architecture

```
browser (public/) ──/api/converse──▶ conversation.js ──MCP client (in-memory)──▶ MCP server (src/mcp.js)
external MCP clients ──────────── Streamable HTTP /mcp ─────────────────────────▶      9 tools
                                                                                         │
            ┌─────────────────────────────┬──────────────────────────────┬───────────────┴──────┐
            ▼                             ▼                              ▼                      ▼
  extractor.js → Token Factory   liveness.js → GitHub API, Tavily   analyzer.js (rules)   store.js → Redis / file
  (Nemotron, JSON schema)        (+ Nemotron quoted fallback)
```

The web page is an ordinary MCP client: every answer comes from MCP tool calls, which each turn lists.

### MCP tools

`analyze_opportunity`, `save_opportunity`, `check_liveness`, `get_opportunity_queue`,
`compare_opportunities`, `build_submission_plan`, `set_opportunity_status`, `daily_briefing`,
`next_best_action`.

## Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env   # add NEBIUS_API_KEY and TAVILY_API_KEY
npm start              # http://127.0.0.1:4310, MCP at /mcp
```

Every key is optional. Without `NEBIUS_API_KEY` the app uses the rule engine and the header shows
"Nemotron · off"; without `TAVILY_API_KEY` only GitHub links are checked.

```bash
npm test        # 35 tests, no network or keys needed (providers are faked)
npm run smoke   # with the server running: real MCP handshake, all 9 tools present
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NEBIUS_API_KEY` | — | Nebius Token Factory key |
| `NEBIUS_MODEL` | `nvidia/nemotron-3-super-120b-a12b` | any Token Factory model id |
| `TAVILY_API_KEY` | — | Tavily key |
| `GITHUB_TOKEN` | — | raises the GitHub API rate limit |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | — | durable queue (otherwise a local JSON file) |
| `BOUNTYPILOT_REDIS_PREFIX` | `bountypilot:ws:` | Redis key prefix |
| `NEBIUS_DAILY_CALLS` / `TAVILY_DAILY_CALLS` | 300 / 150 | per-instance daily budget; past it the app falls back to rules |
| `RATE_LIMIT_PER_10_MIN` | 40 | requests per IP per 10 minutes on `/api/converse` and `/mcp` |

## Honest limits

- Liveness can only see what the linked page says. If claim status lives elsewhere (a Google Sheet,
  a Discord), the answer is `UNKNOWN` and says so.
- Nemotron's answers vary between runs; the quote check means a run can return fewer fields, never
  invented ones.
- Intent routing in the conversation is rule-based on purpose, so every step is explainable.

## Origin

BountyPilot started on 2026-09-29 as a rule-based MCP server for the Amazon Alexa+ hackathon
(`ShenJun93/bountypilot-amazon-2026`). Everything model- and Tavily-related here — Nemotron
extraction with quote verification, `check_liveness`, the evidence UI, budgets — was built during
this hackathon's submission period. Built with AI coding agents; every change was reviewed and tested.

## License

MIT

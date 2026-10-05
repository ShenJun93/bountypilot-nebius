# Judge Readiness — 2026-10-05

## Official scoring

Amazon's current rules score four equally weighted criteria:
1. Tech Implementation
2. Design
3. Potential Impact
4. Quality of the Idea

Alexa+ guidance explicitly favors agentic workflows that maintain state across sessions over single-turn Q&A. Hosting is not required for judging if the public repo is locally runnable and the demo shows the product clearly.

## BountyPilot current strengths

- Self-hosted MCP architecture with Streamable HTTP.
- Persistent opportunity queue and lifecycle state.
- Daily Briefing turns saved state into an execution workflow.
- 23/23 regression tests.
- Public optimized feature branch.
- Protected preview verified with 8 MCP tools.
- Kiro Crew TaskRunner completed 11/11 PASS, supporting AWS Builder eligibility.
- Public mcp-protocol-proof v0.2 branch with 7/7 tests, supporting Open Source mini-challenge.
- Three detailed friction logs already drafted.

## Highest-ROI remaining work

1. **Devpost field audit and edit preview**
   - confirm Alexa+ primary track;
   - AWS Builder = Yes;
   - Open Source = Yes;
   - contribution URL -> public v0.2 commit;
   - verify all 3 friction logs exist in actual fields.
2. **Demo V2**
   - lead with Daily Briefing;
   - show persistence across sessions;
   - show GO vs SKIP guardrail contrast;
   - close on “persistent Alexa+ workflow”, not a generic chatbot.
3. **Presentation assets**
   - one Daily Briefing screenshot;
   - one opportunity triage screenshot;
   - one evidence/protocol proof screenshot.

## Lower-priority / optional

Production promotion from the existing seven-tool public endpoint to the eight-tool candidate is useful for claim consistency, but official rules do not require hosting. Do not let production work displace the Devpost audit or demo polish.

## Stop conditions

Do not save Devpost edits, publish a new video, or promote production without explicit approval.

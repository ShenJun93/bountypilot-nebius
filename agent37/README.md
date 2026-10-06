# BountyWatch on Agent37

An always-on agent that re-checks a watchlist of bounties and hackathons every morning and posts a
short digest: what closed, what got claimed, which deadlines are close, and how fast the
competition is growing. Every status carries the sentence or GitHub API field it was decided from.

Built for the Agent37 x Hackyard Build 2026 challenge, on top of BountyPilot (this repo).

## Files

| File | Purpose |
|---|---|
| `bounty_watch.py` | The checker. Python standard library only, no API keys. |
| `watchlist.json` | The opportunities to watch: name, URL, optional deadline (YYYY-MM-DD). |
| `state.json` | Created on the first run; remembers the last status and counts to report changes. |

## Statuses

| Status | Meaning |
|---|---|
| `OPEN` | The page or API says it is open (quoted). |
| `CLOSED` | Closed or ended wording, or GitHub `state: closed`. |
| `CLAIMED` | GitHub issue assigned to someone. |
| `CONTESTED` | GitHub "Help Wanted" issue with staff assigned (Expensify-style). |
| `UNKNOWN` | No open/closed wording found. Missing "closed" is not proof of "open". |
| `BLOCKED` | The site answered with a bot check. BountyWatch does not try to get around it; check by hand. |

The digest also flags deadlines within 3 days and shows the change in participant or submission
counts since the last run.

## Running on Agent37

1. Free personal agent, Hermes template (sleeps when idle).
2. Put `bounty_watch.py` and `watchlist.json` in the agent's workspace, e.g. `~/bountywatch/`.
3. Ask the agent to run `python3 ~/bountywatch/bounty_watch.py` and reply with the output.
4. Schedule it daily with an Agent37 cron (09:00, Asia/Ho_Chi_Minh). The script does all the
   checking, so each run uses very little model credit: the agent only relays the digest.

## Run locally

```bash
python3 agent37/bounty_watch.py
```

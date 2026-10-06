#!/usr/bin/env python3
"""BountyWatch: re-check a watchlist of bounties/hackathons and print a quote-backed digest.

Standard library only, no API keys, so it runs inside an Agent37 sandbox as-is.
Every status comes with the sentence (or GitHub API field) it was decided from.

Usage: python3 bounty_watch.py [--watchlist watchlist.json] [--state state.json]
"""

import argparse
import datetime as dt
import html
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
UA = "BountyWatch/0.1 (+https://github.com/ShenJun93/bountypilot-nebius)"

CLOSED_PHRASES = [
    "submissions are closed", "submission period has ended", "this hackathon has ended",
    "hackathon has ended", "this hackathon is over", "no longer accepting",
    "applications are closed", "registration is closed", "registrations are closed",
    "deadline has passed", "this listing is closed", "bounty is closed",
    "challenge has ended", "winners have been announced", "winners announced",
    "submissions closed",
]
OPEN_PHRASES = [
    "accepting submissions", "submissions are open", "registration is open",
    "registration is now open", "applications are open", "open now", "apply by",
    "submit by", "join hackathon", "submit now",
]
# Bot checks (AWS WAF, Cloudflare). We report them and never try to get around them.
BOT_CHECK_MARKERS = [
    "awswaf", "verify that you're not a robot", "cf-challenge", "just a moment...",
    "challenge-platform",
]
COUNT_RE = re.compile(r"(\d[\d,]*)\s+(participants|submissions)\b", re.I)
GITHUB_ISSUE_RE = re.compile(r"https://github\.com/([^/]+)/([^/]+)/(?:issues|pull)/(\d+)")


def fetch(url, accept="text/html"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode("utf-8", errors="replace")


def page_text(raw_html):
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw_html)
    text = re.sub(r"(?s)<[^>]+>", "\n", text)
    text = html.unescape(text)
    lines = (re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in text.split("\n"))
    return "\n".join(line for line in lines if line)


def sentence_with(text, phrase):
    for chunk in re.split(r"(?<=[.!?])\s+|\n", text):
        if phrase in chunk.lower():
            chunk = chunk.strip()
            return chunk if len(chunk) <= 200 else chunk[:197] + "..."
    return None


def check_github(owner, repo, number):
    issue = json.loads(fetch(f"https://api.github.com/repos/{owner}/{repo}/issues/{number}",
                             accept="application/vnd.github+json"))
    labels = [label["name"] for label in issue.get("labels", [])]
    assignees = [a["login"] for a in issue.get("assignees", [])]
    help_wanted = any(name.lower() == "help wanted" for name in labels)
    result = {"comments": issue.get("comments", 0)}
    if issue.get("state") == "closed":
        result.update(status="CLOSED", evidence=f'GitHub API: "state": "closed" ({issue.get("state_reason") or "no reason"})')
    elif assignees and not help_wanted:
        result.update(status="CLAIMED", evidence=f'GitHub API: assignees = {", ".join(assignees)}')
    elif assignees:
        result.update(status="CONTESTED", evidence=f'GitHub API: Help Wanted, staff assigned ({", ".join(assignees)}), {result["comments"]} comments')
    else:
        result.update(status="OPEN", evidence=f'GitHub API: "state": "open", no assignees, {result["comments"]} comments')
    return result


def check_page(url):
    raw = fetch(url)
    if any(marker in raw.lower() for marker in BOT_CHECK_MARKERS):
        return {"status": "BLOCKED", "counts": {},
                "evidence": "the site answered with a bot check; not bypassed, open the page yourself"}
    text = page_text(raw)
    lower = text.lower()
    result = {"counts": {}}
    for number, kind in COUNT_RE.findall(text):
        result["counts"].setdefault(kind.lower(), int(number.replace(",", "")))
    for phrase in CLOSED_PHRASES:
        if phrase in lower:
            result.update(status="CLOSED", evidence=sentence_with(text, phrase))
            return result
    for phrase in OPEN_PHRASES:
        if phrase in lower:
            result.update(status="OPEN", evidence=sentence_with(text, phrase))
            return result
    # A page that merely lacks "closed" wording is not proof that it is open.
    result.update(status="UNKNOWN", evidence="no open/closed wording found on the page")
    return result


def check(item):
    match = GITHUB_ISSUE_RE.match(item["url"])
    try:
        return check_github(*match.groups()) if match else check_page(item["url"])
    except (urllib.error.URLError, TimeoutError, ValueError) as err:
        return {"status": "UNKNOWN", "evidence": f"fetch failed: {err}"}


def days_left(deadline, today):
    if not deadline:
        return None
    return (dt.date.fromisoformat(deadline) - today).days


def describe_counts(counts, previous):
    parts = []
    for kind, value in sorted(counts.items()):
        before = (previous or {}).get(kind)
        delta = f" ({value - before:+d})" if before is not None and before != value else ""
        parts.append(f"{value} {kind}{delta}")
    return ", ".join(parts)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--watchlist", default=HERE / "watchlist.json", type=Path)
    parser.add_argument("--state", default=HERE / "state.json", type=Path)
    args = parser.parse_args()

    watchlist = json.loads(args.watchlist.read_text(encoding="utf-8"))
    state = json.loads(args.state.read_text(encoding="utf-8")) if args.state.exists() else {}
    today = dt.date.today()

    changes, rows, new_state = [], [], {}
    for item in watchlist:
        result = check(item)
        before = state.get(item["url"], {})
        new_state[item["url"]] = {"status": result["status"], "counts": result.get("counts", {})}

        left = days_left(item.get("deadline"), today)
        deadline_note = "" if left is None else (f", deadline passed {-left}d ago" if left < 0 else f", {left}d left")
        counts = describe_counts(result.get("counts", {}), before.get("counts"))
        counts_note = f", {counts}" if counts else ""
        evidence = result.get("evidence") or ""
        rows.append(f"- {item['name']}: **{result['status']}**{deadline_note}{counts_note}\n"
                    f"  > {evidence}\n  {item['url']}")

        decided = {"OPEN", "CLOSED", "CLAIMED", "CONTESTED"}
        if before.get("status") in decided and result["status"] in decided and before["status"] != result["status"]:
            changes.append(f"- {item['name']}: {before['status']} -> {result['status']}: {evidence}")
        if left is not None and 0 <= left <= 3:
            changes.append(f"- {item['name']}: deadline in {left} day(s) ({item['deadline']})")

    args.state.write_text(json.dumps(new_state, indent=2), encoding="utf-8")

    print(f"# BountyWatch digest, {today.isoformat()}\n")
    print("## Changed or urgent\n")
    print("\n".join(changes) if changes else "- nothing changed since the last run")
    print("\n## All watched items\n")
    print("\n".join(rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())

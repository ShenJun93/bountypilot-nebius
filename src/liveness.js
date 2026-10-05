// Answers "is this opportunity still open, and is someone already on it?" from the
// canonical source. Aggregators and old summaries go stale; the listing page and the
// issue tracker are what count.

const GITHUB_ISSUE=/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)/i;

const CLOSED_PATTERNS=[
  /submissions? (?:are|is) (?:now )?closed/i,
  /no longer accepting/i,
  /(?:this )?(?:bounty|program|hackathon|challenge) (?:has )?(?:ended|closed|expired)/i,
  /winners? (?:have been |were )?announced/i,
  /registration (?:is )?closed/i,
  /\bpaused\b/i
];
const OPEN_PATTERNS=[
  /registration is (?:now )?open/i,
  /(?:now )?accepting (?:submissions|applications|entries|proposals)/i,
  /submissions? (?:are|is) (?:now )?open/i,
  /applications? (?:are|is) (?:now )?open/i
];
const CLAIMED_PATTERNS=[
  /\b(?:already )?claimed\b/i,
  /\bassigned to\b/i,
  /\btaken\b by/i
];

export const URL_IN_TEXT=/https?:\/\/[^\s<>"')\]]+/i;

// Quote the sentence around a match, falling back to a word-aligned window.
function quoteAround(text,match) {
  const i=match.index ?? 0;
  const before=text.lastIndexOf('.',i-1);
  const after=text.indexOf('.',i+match[0].length);
  let start;
  let end;
  if (before>=0 && i-before<200) start=before+1;
  else {
    start=Math.max(0,i-80);
    while (start>0 && /\S/.test(text[start-1])) start-=1;
  }
  if (after>=0 && after-i<240) end=after+1;
  else {
    end=Math.min(text.length,i+match[0].length+80);
    while (end<text.length && /\S/.test(text[end])) end+=1;
  }
  return text.slice(start,end).replace(/\s+/g,' ').trim();
}

async function githubJson(fetchImpl,path,token) {
  const headers={accept:'application/vnd.github+json','user-agent':'bountypilot'};
  if (token) headers.authorization=`Bearer ${token}`;
  const res=await fetchImpl(`https://api.github.com${path}`,{headers,signal:AbortSignal.timeout(15000)});
  if (!res.ok) throw new Error(`GitHub ${path} responded ${res.status}`);
  return res.json();
}

async function checkGithub(url,{fetchImpl,githubToken}) {
  const [,owner,repo,number]=url.match(GITHUB_ISSUE);
  const issue=await githubJson(fetchImpl,`/repos/${owner}/${repo}/issues/${number}`,githubToken);
  const timeline=await githubJson(fetchImpl,`/repos/${owner}/${repo}/issues/${number}/timeline?per_page=100`,githubToken).catch(()=>[]);
  const linkedPrs=timeline
    .filter((e)=>e.event==='cross-referenced' && e.source?.issue?.pull_request)
    .map((e)=>({
      title:e.source.issue.title,
      url:e.source.issue.html_url,
      state:e.source.issue.pull_request.merged_at ? 'merged' : e.source.issue.state,
      author:e.source.issue.user?.login ?? null
    }));
  const assignees=(issue.assignees ?? []).map((a)=>a.login);
  const labels=(issue.labels ?? []).map((l)=>(typeof l==='string' ? l : l.name));
  // Repos such as Expensify/App assign their own staff and reviewers while an issue is still
  // "Help Wanted"; there an assignee is not a contributor who has claimed the work.
  const seekingHelp=labels.some((l)=>/help\s*wanted/i.test(l));
  const openPrs=linkedPrs.filter((p)=>p.state==='open');
  const evidence=[{source:url,quote:`state: ${issue.state}; labels: ${labels.join(', ') || 'none'}; assignees: ${assignees.join(', ') || 'none'}; comments: ${issue.comments}; linked PRs: ${linkedPrs.length}`}];

  let status='OPEN';
  let summary=`Open on GitHub with ${issue.comments} comments and ${assignees.length && seekingHelp ? 'only maintainers assigned' : 'no assignee'}.`;
  if (issue.state==='closed') {
    status='CLOSED';
    summary=`The issue was closed${issue.closed_at ? ` on ${issue.closed_at.slice(0,10)}` : ''}.`;
  } else if (assignees.length && !seekingHelp) {
    status='CLAIMED';
    summary=`Already assigned to ${assignees.join(', ')}.`;
  } else if (openPrs.length) {
    status='CONTESTED';
    summary=`Still open, but ${openPrs.length} pull request${openPrs.length>1?'s are':' is'} already linked.`;
  } else if (issue.comments>20) {
    status='CONTESTED';
    summary=`Still open, but ${issue.comments} comments suggest heavy competition.`;
  }
  return {status,summary,evidence,competition:linkedPrs.slice(0,5),checks:['github-api']};
}

const VERDICT_SCHEMA={
  type:'object',
  additionalProperties:false,
  required:['status','quote'],
  properties:{
    status:{type:'string',enum:['OPEN','CLOSED','CLAIMED','UNKNOWN']},
    quote:{type:['string','null']}
  }
};

async function checkPage(url,title,{tavily,llm}) {
  const page=await tavily.extract(url);
  const text=page.text ?? '';
  const checks=['tavily-extract'];
  const evidence=[];
  let status='UNKNOWN';

  // Closed and claimed wording wins over open wording found elsewhere on the same page.
  for (const [label,patterns] of [['CLOSED',CLOSED_PATTERNS],['CLAIMED',CLAIMED_PATTERNS],['OPEN',OPEN_PATTERNS]]) {
    for (const p of patterns) {
      const m=text.match(p);
      if (m && status==='UNKNOWN') {
        status=label;
        evidence.push({source:page.url,quote:quoteAround(text,m)});
      }
    }
  }

  // Nemotron reads the page only when the rules found nothing; its answer must quote the page.
  if (status==='UNKNOWN' && llm && text.length>200) {
    checks.push('nemotron-verdict');
    const {data}=await llm.chatJSON({
      system:'You decide whether an opportunity page is still accepting work. Answer OPEN only if the page states it is accepting submissions or applications now; CLOSED if it says it ended, closed, or paused; CLAIMED if it says someone else already took it; otherwise UNKNOWN. "quote" must be copied exactly from the page, or null.',
      user:`Page ${page.url}:\n"""\n${text.slice(0,10000)}\n"""`,
      schema:VERDICT_SCHEMA,
      schemaName:'liveness'
    });
    const norm=(s)=>s.toLowerCase().replace(/\s+/g,' ');
    if (data.quote && norm(text).includes(norm(data.quote.trim()))) {
      status=data.status;
      evidence.push({source:page.url,quote:data.quote.trim(),by:'nemotron'});
    }
  }
  // No quote, no claim: a page that merely lacks "closed" wording is not evidence that it is open.

  let competition=[];
  if (title) {
    checks.push('tavily-search');
    competition=(await tavily.search(`"${title}" pull request OR claimed OR submission`,{maxResults:5}))
      .filter((r)=>r.url!==url);
  }
  const summaries={
    OPEN:'The listing page says it is open.',
    CLOSED:'The listing page says it is closed.',
    CLAIMED:'The listing page says someone has already claimed it.',
    UNKNOWN:'The page neither says it is open nor that it closed, so check it by hand. Claim status may live on another page, such as a linked sheet.'
  };
  return {status,summary:summaries[status],evidence,competition,checks};
}

export async function checkLiveness({url,title=''},{tavily=null,llm=null,fetchImpl=fetch,githubToken=null}={}) {
  const checkedAt=new Date().toISOString();
  try {
    if (GITHUB_ISSUE.test(url)) return {url,checkedAt,...await checkGithub(url,{fetchImpl,githubToken})};
    if (!tavily) {
      return {url,checkedAt,status:'UNKNOWN',summary:'Live page checks need a Tavily key; only GitHub issues can be checked without one.',evidence:[],competition:[],checks:[]};
    }
    return {url,checkedAt,...await checkPage(url,title,{tavily,llm})};
  } catch (error) {
    return {url,checkedAt,status:'UNKNOWN',summary:`The check failed: ${error.message}`,evidence:[],competition:[],checks:['error']};
  }
}

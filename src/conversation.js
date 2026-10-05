// Routes one spoken-style utterance to a sequence of MCP tool calls and returns
// a short reply to read aloud plus visual cards. Intent routing stays rule-based so
// every step is explainable; the listing itself is read by Nemotron when configured.

import {URL_IN_TEXT} from './liveness.js';

const livenessIntent=/\bstill\s+open\b|\bis\s+it\s+open\b|\b(already\s+)?(taken|claimed)\b|\bcheck\s+(the\s+)?(link|url|page)\b|\banyone\s+(else\s+)?(working|on\s+it)\b/i;
const blockingLiveness=new Set(['CLOSED','CLAIMED']);

const statusIntents=[
  [/\b(i\s+)?(just\s+)?submitted\b|\bsubmit(ted)?\s+it\b/i,'submitted'],
  [/\bstart(ed)?\s+building\b|\bi'?m\s+building\b|\bworking\s+on\s+it\b/i,'building'],
  [/\b(we|i)\s+won\b/i,'won'],
  [/\b(we|i)\s+lost\b|\bdidn'?t\s+win\b/i,'lost'],
  [/\bskip\s+(it|this|that)\b|\bnot\s+worth\s+it\b|\bdrop\s+(it|this|that)\b/i,'skipped']
];

function detectIntent(utterance,listing) {
  if (listing) return {kind:'triage'};
  if (livenessIntent.test(utterance)) return {kind:'liveness'};
  for (const [pattern,status] of statusIntents) if (pattern.test(utterance)) return {kind:'status',status};
  if (/\bplan\b/i.test(utterance)) return {kind:'plan'};
  if (/\b(queue|pipeline|list|saved|what\s+do\s+i\s+have)\b/i.test(utterance)) return {kind:'queue'};
  if (/\b(next|today|work\s+on|should\s+i|focus|priority)\b/i.test(utterance)) return {kind:'next'};
  if (!utterance.trim() || /\b(hello|hi|hey|open|welcome|start)\b/i.test(utterance)) return {kind:'greet'};
  return {kind:'help'};
}

function data(call) {
  return call.response?.structuredContent ?? null;
}

function opportunityCard(analysis) {
  return {
    type:'opportunity',
    title:analysis.title,
    verdict:analysis.verdict,
    score:analysis.score,
    reward:analysis.reward?.text ?? null,
    deadline:analysis.deadline ?? null,
    liveGate:analysis.signals.liveGate,
    preHire:analysis.signals.preHireGate,
    reasons:analysis.reasons,
    unknowns:analysis.unknowns,
    evidence:analysis.evidence ?? [],
    engine:analysis.engine ?? {extractor:'rules'}
  };
}

function livenessCard(check,title) {
  return {type:'liveness',title,url:check.url,status:check.status,summary:check.summary,evidence:check.evidence,competition:check.competition,checks:check.checks};
}

function queueCard(opportunities) {
  return {
    type:'queue',
    items:opportunities.map((item)=>({
      id:item.id,
      title:item.title,
      status:item.status,
      verdict:item.analysis.verdict,
      score:item.analysis.score,
      reward:item.analysis.reward?.text ?? null,
      deadline:item.analysis.deadline ?? null
    }))
  };
}

const isOpen=(item)=>!['won','lost','skipped'].includes(item.status);

function mentioned(utterance,opportunities) {
  const text=utterance.toLowerCase();
  return opportunities.find((item)=>{
    const words=item.title.toLowerCase().split(/[^a-z0-9]+/).filter((w)=>w.length>=4);
    return words.some((w)=>text.includes(w));
  }) ?? null;
}

export async function converse({utterance='',title='',listing='',workspace='default'},callTool) {
  const trace=[];
  const call=async(name,args={})=>{
    const out=await callTool(name,{...args,workspace});
    trace.push({tool:name,transport:out.transport});
    return out;
  };
  const noWorkspace=async(name,args)=>{
    const out=await callTool(name,args);
    trace.push({tool:name,transport:out.transport});
    return out;
  };

  const intent=detectIntent(utterance,listing.trim());
  const cards=[];
  let reply;

  if (intent.kind==='triage') {
    const name=title.trim() || listing.trim().split(/[.\n]/)[0].slice(0,80) || 'Untitled opportunity';
    const sourceUrl=listing.match(URL_IN_TEXT)?.[0]?.replace(/[.,;:]+$/,'');
    const urlArg=sourceUrl ? {sourceUrl} : {};
    const analysis=data(await noWorkspace('analyze_opportunity',{title:name,listing,...urlArg})).analysis;
    const saved=data(await call('save_opportunity',{title:name,listing,...urlArg}));
    cards.push(opportunityCard(analysis));
    const reward=analysis.reward?.text ?? 'no stated reward';
    const deadline=analysis.deadline ? `the deadline is ${analysis.deadline}` : 'no deadline is stated';

    // A listing that is already closed or claimed is not worth reading further.
    const live=sourceUrl ? data(await noWorkspace('check_liveness',{url:sourceUrl,title:name})) : null;
    if (live) cards.push(livenessCard(live,name));
    if (live && blockingLiveness.has(live.status)) {
      await call('set_opportunity_status',{id:saved.id,status:'skipped'});
      reply=`I'd skip this one: it looks ${live.status.toLowerCase()} at the source. ${live.summary} I saved it as skipped.`;
      return {intent:intent.kind,reply:reply.replace(/\s+/g,' ').trim(),cards,trace};
    }
    const contested=live?.status==='CONTESTED' ? ` Heads up: ${live.summary}` : '';

    if (analysis.verdict==='SKIP') {
      await call('set_opportunity_status',{id:saved.id,status:'skipped'});
      reply=`I'd skip this one. ${analysis.reasons[0] ?? ''} I saved it as skipped so it won't come back as a suggestion.`;
    } else {
      const next=data(await call('next_best_action'));
      if (analysis.verdict==='GO') {
        const step=next.opportunity?.id===saved.id ? next.nextAction : null;
        reply=`That one fits. It pays ${reward}, ${deadline}, and I found no interview gate. I saved it.`;
        reply+=step ? ` Your next step: ${step}` : ' Say "plan my top opportunity" when you are ready to start.';
      } else {
        const blocker=analysis.signals.preHireGate
          ? 'You have to be selected or hired before you can start.'
          : (analysis.unknowns[0] ?? 'Something needs checking first.');
        reply=`Maybe. ${blocker} I saved it so we can come back to it.`;
        if (next.opportunity && next.opportunity.id!==saved.id) reply+=` Your top priority is still ${next.opportunity.title}.`;
      }
      reply+=contested;
    }
    return {intent:intent.kind,reply:reply.replace(/\s+/g,' ').trim(),cards,trace};
  }

  const queue=data(await call('get_opportunity_queue')).opportunities;
  const open=queue.filter(isOpen);

  if (intent.kind==='liveness') {
    const spokenUrl=utterance.match(URL_IN_TEXT)?.[0];
    const target=spokenUrl ? null : (mentioned(utterance,queue) ?? open.find((item)=>item.sourceUrl));
    const url=spokenUrl ?? target?.sourceUrl;
    if (!url) {
      reply='I need a link to check. Paste the listing URL, or save a listing that includes one.';
      return {intent:intent.kind,reply,cards,trace};
    }
    const live=data(await noWorkspace('check_liveness',{url,title:target?.title}));
    cards.push(livenessCard(live,target?.title ?? url));
    reply=`${target ? `${target.title}: ` : ''}${live.status.toLowerCase()}. ${live.summary}`;
    if (target && blockingLiveness.has(live.status)) {
      await call('set_opportunity_status',{id:target.id,status:'skipped'});
      reply+=' I marked it as skipped.';
    }
    return {intent:intent.kind,reply,cards,trace};
  }

  if (intent.kind==='status' || intent.kind==='plan') {
    const target=mentioned(utterance,queue) ?? open[0];
    if (!target) {
      reply='Your queue is empty. Paste a listing and ask me whether it is worth building.';
    } else if (intent.kind==='status') {
      await call('set_opportunity_status',{id:target.id,status:intent.status});
      const next=data(await call('next_best_action'));
      cards.push({type:'status',title:target.title,status:intent.status});
      reply=`Got it, ${target.title} is now ${intent.status}.`;
      if (next.opportunity?.id===target.id) reply+=` ${next.nextAction}`;
      else if (next.opportunity) reply+=` Next up: ${next.opportunity.title}. ${next.nextAction}`;
    } else {
      const plan=data(await call('build_submission_plan',{id:target.id}));
      cards.push({type:'plan',title:plan.title,status:plan.status,steps:plan.steps});
      reply=`Here is the plan for ${plan.title}. First: ${plan.steps[0]}`;
    }
    return {intent:intent.kind,reply,cards,trace};
  }

  if (intent.kind==='queue') {
    cards.push(queueCard(queue));
    reply=open.length
      ? `You have ${open.length} open ${open.length===1?'opportunity':'opportunities'}. The best fit is ${open[0].title}.`
      : 'Nothing open in your queue right now.';
    return {intent:intent.kind,reply,cards,trace};
  }

  if (intent.kind==='next') {
    const briefing=data(await call('daily_briefing',{limit:3}));
    if (!briefing) {
      reply='Sorry, I could not load your briefing right now. Please try again.';
    } else if (!briefing.priorities.length) {
      reply='Your queue is empty. Paste a listing and ask me whether it is worth building.';
    } else {
      const [first,second]=briefing.priorities;
      const nextAction=first.nextAction ?? 'no next action recorded';
      reply=`Today's focus is ${first.title}, currently ${first.status}. Next: ${nextAction}`;
      if (second) reply+=` Second priority: ${second.title}.`;
      cards.push({type:'briefing',activeCount:briefing.activeCount,items:briefing.priorities});
    }
    return {intent:intent.kind,reply,cards,trace};
  }

  if (intent.kind==='greet') {
    const next=data(await call('next_best_action'));
    if (!next.opportunity) {
      reply="Hi, I'm BountyPilot. Paste a bounty or hackathon listing and ask me whether it's worth building.";
    } else {
      const lead=`Welcome back. You have ${open.length} open ${open.length===1?'opportunity':'opportunities'}. `;
      reply=`${lead}Your best open opportunity is ${next.opportunity.title}, currently ${next.opportunity.status}. Next: ${next.nextAction}`;
      cards.push(queueCard(open));
    }
    return {intent:intent.kind,reply,cards,trace};
  }

  return {
    intent:'help',
    reply:'I can check whether a listing is worth building, check whether it is still open, show your queue, plan your top opportunity, or record that you started, submitted, won or lost it.',
    cards,
    trace
  };
}

const moneyPattern = /(?:\$|USD\s*|USDC\s*)(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)/gi;
// "Submit a pull request" is not a deadline; only "submit by", "closes on", "due" and the like are.
const deadlinePattern = /\b(?:deadline|due(?:\s+(?:date|by|on))?|submit(?:ted)?\s+by|submissions?\s+close|closes?(?:\s+on)?|ends?\s+on)\b\s*[:\-]?\s*([^\n.]{3,90})/i;

const liveGatePatterns = [
  /\binterview\b/i,
  /\bzoom\b/i,
  /\blive\s+(?:coding|assessment|review|demo|call)\b/i,
  /\btechnical\s+assessment\b/i,
  /\bsales\s+call\b/i,
  /\bphone\s+screen\b/i,
  /\bmeeting\s+required\b/i
];

const explicitAsyncPatterns = [
  /\bno\s+interviews?\b/i,
  /\bwithout\s+an?\s+interview\b/i,
  /\bno\s+calls?\s+required\b/i,
  /\basynchronous(?:ly)?\b/i,
  /\basync\b/i
];

const submissionPatterns = [
  /\bgithub\b/i,
  /\brepositor(?:y|ies)\b/i,
  /\bpull\s+request\b/i,
  /\bdemo\s+video\b/i,
  /\bdevpost\b/i,
  /\bsubmit(?:ted|ting|s)?\b/i,
  /\bcode\s+submission\b/i
];

const preHirePatterns = [
  /\bmust\s+be\s+hired\b/i,
  /\bwait\s+for\s+(?:assignment|approval)\b/i,
  /\bassigned\s+before\b/i,
  /\bupwork\s+(?:hire|hiring|contract)\b/i,
  /\bproposal\s+review\b/i
];

const unpaidPatterns = [
  /\bunpaid\b/i,
  /\bvolunteer\b/i,
  /\bno\s+(?:cash\s+)?prize\b/i,
  /\bno\s+payment\b/i
];

function evidence(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    // Widen the window to whole words so a snippet never starts or ends mid-word.
    const index = match.index ?? 0;
    let start = Math.max(0, index - 45);
    let end = Math.min(text.length, index + match[0].length + 70);
    while (start > 0 && /\S/.test(text[start - 1])) start -= 1;
    while (end < text.length && /\S/.test(text[end])) end += 1;
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
  }
  return null;
}

function extractReward(text) {
  const matches=[...text.matchAll(moneyPattern)]
    .map((match)=>({
      text: match[0].trim(),
      amount: Number(match[1].replace(/,/g,'')) || 0
    }))
    .sort((a,b)=>b.amount-a.amount);
  return matches[0] ?? null;
}

function extractDeadline(text) {
  return text.match(deadlinePattern)?.[1]?.trim() ?? null;
}

function isNegatedLiveGate(text) {
  return explicitAsyncPatterns.some((pattern)=>pattern.test(text));
}

function hasLiveGate(text) {
  let scrubbed=text;
  scrubbed=scrubbed
    .replace(/no\s+interviews?/gi,'')
    .replace(/without\s+an?\s+interview/gi,'')
    .replace(/no\s+calls?\s+required/gi,'');
  return liveGatePatterns.some((pattern)=>pattern.test(scrubbed));
}

// `extraction` is the verified output of extractWithModel. The rules stay the guardrail:
// a verified model field can add a blocker or fill a missing reward/deadline, but it can
// never clear a blocker the rules found.
export function analyzeOpportunity({title='', listing=''}, extraction=null) {
  const text=`${title}\n${listing}`.trim();
  if (!text) throw new Error('listing is required');
  const model=extraction?.verified ?? {};

  const ruleReward=extractReward(text);
  const ruleDeadline=extractDeadline(text);
  const modelReward=model.reward ? {text:model.reward.text ?? model.reward.quote, amount:model.reward.amountUsd ?? 0} : null;
  const reward=ruleReward ?? modelReward;
  const deadline=ruleDeadline ?? model.deadline?.text ?? null;
  const ruleSignals={
    liveGate: hasLiveGate(text),
    explicitAsync: isNegatedLiveGate(text),
    codeSubmission: submissionPatterns.some((pattern)=>pattern.test(text)),
    preHireGate: preHirePatterns.some((pattern)=>pattern.test(text)),
    unpaid: unpaidPatterns.some((pattern)=>pattern.test(text))
  };
  const signals={
    ...ruleSignals,
    liveGate: ruleSignals.liveGate || model.liveGate?.present===true,
    preHireGate: ruleSignals.preHireGate || model.preHireGate?.present===true,
    unpaid: ruleSignals.unpaid || model.unpaid?.present===true,
    codeSubmission: ruleSignals.codeSubmission || Boolean(model.submissionPath)
  };
  // A live gate the model found outranks generic "async" wording elsewhere in the listing.
  if (signals.liveGate) signals.explicitAsync=false;

  let score=50;
  const adjustments=[{delta:50,label:'Base fit'}];
  const reasons=[];
  const unknowns=[];
  const add=(delta,label)=>{
    score+=delta;
    adjustments.push({delta,label});
  };

  if (signals.unpaid) {
    add(-60,'Explicit unpaid/no-prize wording');
    reasons.push('The opportunity explicitly says it is unpaid or has no prize.');
  }
  if (signals.liveGate) {
    add(-45,'Mandatory live/interview gate');
    reasons.push('A mandatory interview or live gate conflicts with the async profile.');
  } else if (signals.explicitAsync) {
    add(18,'Explicit async/no-interview wording');
    reasons.push('The listing explicitly supports asynchronous work.');
  } else {
    unknowns.push('Interview/live-call requirement is not explicit.');
  }

  if (signals.codeSubmission) {
    add(18,'Code/repo/demo submission path');
    reasons.push('The listing exposes a code, repository, PR, demo, or Devpost submission path.');
  } else {
    add(-6,'Submission path unclear');
    unknowns.push('A concrete code/repo/demo submission path was not detected.');
  }

  if (signals.preHireGate) {
    add(-16,'Pre-hire or assignment gate');
    reasons.push('Selection or hiring is required before implementation.');
  }

  if (reward) {
    const delta=reward.amount>=5000?16:reward.amount>=1000?12:reward.amount>=250?8:3;
    add(delta,`Reward signal ${reward.text}`);
    reasons.push(`Reward detected: ${reward.text}.`);
  } else {
    add(-8,'Reward unknown');
    unknowns.push('Exact reward amount was not detected.');
  }

  if (deadline) {
    add(4,'Deadline stated');
    reasons.push('A deadline is visible, so the work can be scheduled.');
  } else {
    unknowns.push('Deadline was not detected.');
  }

  score=Math.max(0,Math.min(100,Math.round(score)));
  let verdict='REVIEW';
  if (signals.unpaid || signals.liveGate) verdict='SKIP';
  else if (!signals.preHireGate && signals.codeSubmission && score>=72) verdict='GO';

  const extractedEvidence=[];
  // A verified model quote is an exact sentence from the listing, so it reads better than
  // the rules' fixed-width window; the rules' snippet is the fallback.
  const cite=(label,ruleValue,modelField)=>{
    if (modelField?.quote) extractedEvidence.push({label,value:modelField.quote,source:'nemotron'});
    else if (ruleValue) extractedEvidence.push({label,value:ruleValue,source:'rules'});
  };
  cite('Reward',ruleReward?.text,model.reward);
  cite('Deadline',ruleDeadline,model.deadline);
  if (signals.liveGate) cite('Live gate',ruleSignals.liveGate && evidence(text,liveGatePatterns),model.liveGate);
  if (signals.explicitAsync) cite('Async',evidence(text,explicitAsyncPatterns),null);
  if (signals.codeSubmission) cite('Submission',ruleSignals.codeSubmission && evidence(text,submissionPatterns),model.submissionPath);
  if (signals.preHireGate) cite('Pre-hire',ruleSignals.preHireGate && evidence(text,preHirePatterns),model.preHireGate);
  if (signals.unpaid) cite('Unpaid',ruleSignals.unpaid && evidence(text,unpaidPatterns),model.unpaid);
  cite('Eligibility',null,model.eligibility);

  const engine=extraction
    ? {extractor:extraction.engine,model:extraction.model,verifiedFields:Object.keys(model),rejected:extraction.rejected,ms:extraction.ms}
    : {extractor:'rules'};
  return {title:title.trim() || 'Untitled opportunity', verdict, score, reward, deadline, signals, reasons, unknowns, adjustments, evidence:extractedEvidence, engine};
}

export function buildSubmissionPlan(opportunity) {
  const a=opportunity.analysis;
  if (opportunity.status==='submitted') return ['Watch for the results announcement, then record the outcome as won or lost.'];
  const steps=[];
  if (a.signals.preHireGate) steps.push('Wait for formal assignment/hiring before opening an implementation PR.');
  if (!a.deadline) steps.push('Verify the official deadline before allocating build time.');
  if (!a.reward) steps.push('Verify the exact prize/reward and payout terms.');
  if (a.verdict==='SKIP') {
    steps.push('Do not allocate implementation time unless the blocking live/unpaid condition changes.');
    return steps;
  }
  steps.push('Read the official rules and freeze a minimum acceptance checklist.');
  steps.push('Build the smallest end-to-end demo that satisfies every required artifact.');
  steps.push('Run mechanical tests and capture evidence for the demo.');
  steps.push('Prepare repository, demo video, and submission form assets.');
  steps.push('Submit before the deadline and record the submission receipt.');
  return steps;
}

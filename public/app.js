import {briefingItems,renderCardSafely} from './render-guards.js';

const $=(selector)=>document.querySelector(selector);

const transcript=$('#transcript');
const composer=$('#composer');
const utteranceInput=$('#utterance');
const sendButton=$('#sendButton');
const attachment=$('#attachment');
const attachmentTitle=$('#attachmentTitle');
const listingTitle=$('#listingTitle');
const listingText=$('#listingText');
const queue=$('#queue');
const runtimeBadge=$('#runtimeBadge');
const storageBadge=$('#storageBadge');
const engineBadge=$('#engineBadge');
const voiceToggle=$('#voiceToggle');

const samples={
  go:{
    title:'Build With AI: Basics',
    listing:'Build With AI: Basics. $1,250 cash first prize. Deadline: October 26, 2026. Build a new app and submit a public GitHub repository plus a 1–3 minute demo video. No interview required. Judging is asynchronous after submission.'
  },
  review:{
    title:'External Help Wanted — $250',
    listing:'$250 reward. Post a proposal and wait for assignment. You must be hired through Upwork before creating a pull request. GitHub implementation is required after selection.'
  },
  skip:{
    title:'Developer challenge with live final',
    listing:'$500 developer challenge. Deadline: October 12. Submit a GitHub repository first. Shortlisted developers must complete a live technical interview on Zoom and a live demo call.'
  },
  // The rules miss this gate ("video call with the judges"); Nemotron has to find and quote it.
  hidden:{
    title:'Agent Build Week',
    listing:'Agent Build Week. Prize pool: 2,000 USDC for the winner. Entries close on the last Friday of October. Build an agent and submit it through the Devpost form with a public repository. Finalists present their project on a video call with the judges before winners are chosen.'
  },
  github:{
    title:'[Bounty $1.5k] Improve div_no_nan accuracy to 1 ULP',
    listing:'Tenstorrent bounty: improve ttnn.div_no_nan from 2 ULP to 1 ULP error while preserving divide-by-zero semantics. Reward: $1,500. Submit a pull request with adversarial accuracy tests. https://github.com/tenstorrent/tt-metal/issues/58228'
  }
};

const storageLabels={
  'redis-durable':['State · durable','Saved in Redis; survives restarts and redeploys.',true],
  'local-file':['State · local file','Saved to data/state.json on this machine.',true],
  'ephemeral-vercel-tmp':['State · temporary','Hosted demo without a database: the queue may reset on a cold start.',false],
  memory:['State · memory','In-memory only.',false]
};

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key,value) {
  try { localStorage.setItem(key,value); } catch { /* private mode: fall back to a per-tab id */ }
}

let workspace=storageGet('bountypilot.workspace');
if (!workspace || !/^[A-Za-z0-9_-]{1,64}$/.test(workspace)) {
  workspace=crypto.randomUUID();
  storageSet('bountypilot.workspace',workspace);
}
$('#workspaceId').textContent=workspace.slice(0,8);

const canSpeak='speechSynthesis' in window;
let voiceOn=canSpeak && storageGet('bountypilot.voice')!=='off';
let userHasInteracted=false;

function renderVoiceToggle() {
  voiceToggle.hidden=!canSpeak;
  voiceToggle.textContent=`Voice replies · ${voiceOn?'on':'off'}`;
  voiceToggle.setAttribute('aria-pressed',String(voiceOn));
}

function speak(text) {
  // Browsers block speech before the first user gesture, so the page-load greeting stays silent.
  if (!voiceOn || !userHasInteracted) return;
  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='en-US';
  utterance.rate=1.02;
  speechSynthesis.speak(utterance);
}

async function api(path,options={}) {
  const response=await fetch(path,{
    ...options,
    headers:{'content-type':'application/json',...(options.headers??{})}
  });
  const body=await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function el(tag,className,text) {
  const node=document.createElement(tag);
  if (className) node.className=className;
  if (text!==undefined) node.textContent=text;
  return node;
}

function scrollToEnd() {
  transcript.scrollTop=transcript.scrollHeight;
}

function addUserTurn(text,listing) {
  const turn=el('div','turn user');
  turn.append(el('p','bubble',text));
  if (listing) turn.append(el('p','attached',`Listing attached: ${listing.title || 'untitled'}`));
  transcript.append(turn);
  scrollToEnd();
}

function renderOpportunityCard(card) {
  const box=el('div','card opportunity');
  const head=el('div','card-head');
  const verdict=el('span','verdict-chip',card.verdict);
  verdict.dataset.kind=card.verdict.toLowerCase();
  head.append(verdict,el('strong','',card.title),el('span','card-score',`${card.score}/100`));
  box.append(head);

  const facts=el('div','facts');
  for (const [label,value] of [
    ['Reward',card.reward ?? 'Unknown'],
    ['Deadline',card.deadline ?? 'Unknown'],
    ['Live gate',card.liveGate?'Detected':'None detected'],
    ['Pre-hire',card.preHire?'Required':'None detected']
  ]) {
    const cell=el('div');
    cell.append(el('span','',label),el('strong','',value));
    facts.append(cell);
  }
  box.append(facts);

  const why=[...card.reasons,...card.unknowns.map((x)=>`Unknown: ${x}`)];
  if (why.length) {
    const list=el('ul','why');
    for (const line of why) list.append(el('li','',line));
    box.append(list);
  }

  if (card.evidence?.length) {
    const quotes=el('ul','evidence');
    for (const item of card.evidence) {
      const li=el('li');
      const label=el('span','label',item.label);
      const src=el('span','src',item.source ?? 'rules');
      src.dataset.src=item.source ?? 'rules';
      label.append(src);
      li.append(label,el('q','',item.value));
      quotes.append(li);
    }
    box.append(quotes);
  }

  const engine=card.engine ?? {extractor:'rules'};
  if (engine.error) {
    box.append(el('p','engine-line warn',`Nemotron was unavailable (${engine.error}); this answer uses the rules only.`));
  } else if (engine.model) {
    const dropped=engine.rejected?.length ? ` · ${engine.rejected.length} unquoted field${engine.rejected.length>1?'s':''} discarded` : '';
    box.append(el('p','engine-line',`Read by ${engine.model} on Nebius Token Factory in ${engine.ms} ms · every quote checked against the listing${dropped}`));
  } else {
    box.append(el('p','engine-line','Read by the rule engine'));
  }
  return box;
}

function renderLivenessCard(card) {
  const box=el('div','card liveness');
  const head=el('div','card-head');
  const chip=el('span','verdict-chip',card.status);
  chip.dataset.kind=card.status.toLowerCase();
  head.append(chip,el('strong','','Still open?'),el('span','status',(card.checks ?? []).join(' + ') || 'no check'));
  box.append(head,el('p','summary',card.summary));
  if (card.evidence?.length) {
    const quotes=el('ul','evidence');
    for (const item of card.evidence) {
      const li=el('li');
      const label=el('span','label',new URL(item.source).hostname);
      if (item.by) {
        const src=el('span','src',item.by);
        src.dataset.src=item.by;
        label.append(src);
      }
      li.append(label,el('q','',item.quote));
      quotes.append(li);
    }
    box.append(quotes);
  }
  if (card.competition?.length) {
    const list=el('ul','competition');
    for (const item of card.competition.slice(0,4)) {
      const li=el('li');
      const a=el('a','',item.title ?? item.url);
      a.href=item.url;
      a.target='_blank';
      a.rel='noopener';
      li.append(a);
      if (item.state) li.append(` · ${item.state}`);
      list.append(li);
    }
    box.append(el('span','label','Related work found'),list);
  }
  return box;
}

function renderPlanCard(card) {
  const box=el('div','card plan-card');
  const head=el('div','card-head');
  head.append(el('strong','',`Plan · ${card.title}`),el('span','status',card.status));
  box.append(head);
  const list=el('ol');
  for (const step of card.steps) list.append(el('li','',step));
  box.append(list);
  return box;
}

function renderQueueCarousel(card) {
  const rail=el('div','carousel');
  if (!card.items.length) {
    rail.append(el('p','queue-empty','Nothing saved yet.'));
    return rail;
  }
  for (const item of card.items) {
    const tile=el('div','tile');
    tile.append(el('strong','tile-score',String(item.score)),el('span','tile-title',item.title));
    const meta=el('span','tile-meta',`${item.verdict} · ${item.status}`);
    tile.append(meta,el('span','tile-sub',item.reward ?? 'reward unknown'));
    rail.append(tile);
  }
  return rail;
}

function renderBriefingCard(card) {
  const box=el('div','card briefing-card');
  const head=el('div','card-head');
  head.append(el('strong','','Today\'s priority brief'),el('span','status',`${card.activeCount} active`));
  box.append(head);

  const list=el('ol','briefing-list');
  const items=briefingItems(card);
  if (!items.length) {
    list.append(el('li','briefing-empty','Nothing actionable right now.'));
  } else {
    for (const item of items) {
      const li=el('li','briefing-item');
      const title=el('strong','',item.title);
      const meta=el('span','briefing-meta',`${item.score}/100 · ${item.status} · ${item.reward ?? 'reward unknown'} · ${item.deadline ?? 'deadline unknown'}`);
      const next=el('span','briefing-next',`Next: ${item.nextAction}`);
      li.append(title,meta,next);
      if (item.blocker) li.append(el('span','briefing-blocker',`Watch: ${item.blocker}`));
      list.append(li);
    }
  }
  box.append(list);
  return box;
}

function renderStatusCard(card) {
  return el('div','card status-card',`${card.title} → ${card.status}`);
}

const renderers={
  opportunity:renderOpportunityCard,
  plan:renderPlanCard,
  queue:renderQueueCarousel,
  briefing:renderBriefingCard,
  status:renderStatusCard,
  liveness:renderLivenessCard
};

function addAssistantTurn(payload) {
  const turn=el('div','turn assistant');
  const bubble=el('div','bubble');
  bubble.append(el('span','orb small'),el('p','',payload.reply));
  turn.append(bubble);
  for (const card of payload.cards ?? []) {
    const {node,error}=renderCardSafely(renderers,card);
    if (node) turn.append(node);
    else if (error) turn.append(el('p','bubble error',`Card render error (${card?.type ?? 'unknown'}): ${error}`));
  }

  if (payload.trace?.length) {
    const details=el('details','trace');
    details.append(el('summary','',`${payload.trace.length} MCP tool call${payload.trace.length===1?'':'s'}`));
    const list=el('ol');
    for (const step of payload.trace) {
      const li=el('li');
      li.append(el('strong','',step.tool),el('em','',step.transport));
      list.append(li);
    }
    details.append(list);
    turn.append(details);
  }
  transcript.append(turn);
  scrollToEnd();
  speak(payload.reply);
}

function addErrorTurn(message) {
  const turn=el('div','turn assistant');
  turn.append(el('p','bubble error',`Something went wrong: ${message}`));
  transcript.append(turn);
  scrollToEnd();
}

function renderQueue(data) {
  const opportunities=data?.opportunities ?? [];
  queue.innerHTML='';
  if (!opportunities.length) {
    queue.append(el('p','queue-empty','Nothing saved yet.'));
    return;
  }
  for (const item of opportunities) {
    const row=el('article','queue-item');
    const score=el('div','queue-score');
    score.append(el('strong','',String(item.analysis.score)),el('span','','fit'));
    const main=el('div','queue-main');
    const top=el('div','queue-top');
    top.append(el('h3','',item.title),el('span','status',item.status));
    main.append(top,el('p','',`${item.analysis.verdict} · ${item.analysis.reward?.text ?? 'reward unknown'} · ${item.analysis.deadline ?? 'deadline unknown'}`));
    row.append(score,main);
    queue.append(row);
  }
}

async function refreshQueue() {
  const result=await api(`/api/queue?workspace=${encodeURIComponent(workspace)}`);
  runtimeBadge.textContent='MCP · connected';
  runtimeBadge.classList.add('connected');
  renderQueue(result.queue);
}

function currentListing() {
  if (attachment.classList.contains('hidden')) return null;
  const listing=listingText.value.trim();
  if (!listing) return null;
  return {title:listingTitle.value.trim(),listing};
}

function attach(sample) {
  attachment.classList.remove('hidden');
  listingTitle.value=sample?.title ?? '';
  listingText.value=sample?.listing ?? '';
  attachmentTitle.textContent=sample ? 'Sample listing attached' : 'Your listing';
  if (!utteranceInput.value.trim()) utteranceInput.value='Is this worth building?';
  (sample ? utteranceInput : listingText).focus();
}

function detach() {
  attachment.classList.add('hidden');
  listingTitle.value='';
  listingText.value='';
}

async function send(utterance,{silentUser=false}={}) {
  const listing=currentListing();
  const text=utterance.trim() || (listing ? 'Is this worth building?' : '');
  if (!text) return;
  if (!silentUser) addUserTurn(text,listing);
  sendButton.disabled=true;
  try {
    const payload=await api('/api/converse',{
      method:'POST',
      body:JSON.stringify({utterance:text,workspace,...(listing??{})})
    });
    runtimeBadge.textContent='MCP · connected';
    runtimeBadge.classList.add('connected');
    addAssistantTurn(payload);
    if (listing) detach();
    await refreshQueue();
  } catch (error) {
    addErrorTurn(error.message);
  } finally {
    sendButton.disabled=false;
  }
}

composer.addEventListener('submit',(event)=>{
  event.preventDefault();
  userHasInteracted=true;
  const text=utteranceInput.value;
  utteranceInput.value='';
  send(text);
});

for (const button of document.querySelectorAll('[data-say]')) {
  button.addEventListener('click',()=>{
    userHasInteracted=true;
    send(button.dataset.say);
  });
}

for (const button of document.querySelectorAll('[data-sample]')) {
  button.addEventListener('click',()=>attach(samples[button.dataset.sample]));
}
$('#ownListingButton').addEventListener('click',()=>attach(null));
$('#removeAttachment').addEventListener('click',detach);

voiceToggle.addEventListener('click',()=>{
  userHasInteracted=true;
  voiceOn=!voiceOn;
  storageSet('bountypilot.voice',voiceOn?'on':'off');
  if (!voiceOn && canSpeak) speechSynthesis.cancel();
  renderVoiceToggle();
});

$('#newSessionButton').addEventListener('click',()=>{
  userHasInteracted=true;
  transcript.innerHTML='';
  send('Open BountyPilot');
});

$('#resetButton').addEventListener('click',async()=>{
  userHasInteracted=true;
  await api('/api/reset',{method:'POST',body:JSON.stringify({workspace})});
  transcript.innerHTML='';
  await refreshQueue();
  send('Open BountyPilot',{silentUser:true});
});

$('#refreshQueueButton').addEventListener('click',()=>refreshQueue().catch(()=>{}));

async function boot() {
  renderVoiceToggle();
  try {
    const health=await api('/health');
    const [label,title,durable]=storageLabels[health.state] ?? [`State · ${health.state}`,'',false];
    storageBadge.textContent=label;
    storageBadge.title=title;
    storageBadge.classList.toggle('connected',durable);
    storageBadge.classList.toggle('warn',!durable);
    const nemotron=/nemotron/i.test(health.engines?.extractor ?? '');
    engineBadge.textContent=nemotron ? 'Nemotron · on' : 'Nemotron · off';
    engineBadge.title=health.engines?.extractor ?? '';
    engineBadge.classList.toggle('connected',nemotron);
    engineBadge.classList.toggle('warn',!nemotron);
  } catch {
    storageBadge.textContent='State · unknown';
  }
  await refreshQueue().catch(()=>{});
  send('Open BountyPilot',{silentUser:true});
}

boot();

import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {InMemoryTransport} from '@modelcontextprotocol/server';
import {OpportunityStore} from '../src/store.js';
import {MemoryBackend} from '../src/backends.js';
import {buildMcpServer} from '../src/mcp.js';
import {converse} from '../src/conversation.js';

// Real MCP round trips over the in-memory transport, same as the simulator.
function mcpCaller(store) {
  return async(name,args)=>{
    const [c,s]=InMemoryTransport.createLinkedPair();
    const server=buildMcpServer(store);
    const client=new Client({name:'test',version:'0'},{versionNegotiation:{mode:'auto'}});
    try {
      await Promise.all([server.connect(s),client.connect(c)]);
      const response=await client.callTool({name,arguments:args});
      if (response.isError) throw new Error(response.content[0].text);
      return {transport:'in-memory-mcp',response};
    } finally {
      await Promise.allSettled([client.close(),server.close()]);
    }
  };
}

const GO='Build With AI: Basics. $1,250 cash first prize. Deadline: October 26, 2026. Submit a public GitHub repository plus a demo video. No interview required.';
const SKIP='$500 developer challenge. Deadline: October 12. Submit a GitHub repository first. Shortlisted developers must complete a live technical interview on Zoom.';
const REVIEW='$250 reward. Post a proposal and wait for assignment. You must be hired through Upwork before creating a pull request. GitHub implementation is required after selection.';

function setup() {
  const store=new OpportunityStore(new MemoryBackend());
  return {store,call:mcpCaller(store)};
}

test('greeting on an empty workspace invites a listing',async()=>{
  const {call}=setup();
  const out=await converse({utterance:'Alexa, open BountyPilot',workspace:'w1'},call);
  assert.equal(out.intent,'greet');
  assert.match(out.reply,/Paste a bounty/);
});

test('a GO listing is analyzed, saved and followed by a next action',async()=>{
  const {store,call}=setup();
  const out=await converse({utterance:'Is this worth building?',title:'Build With AI',listing:GO,workspace:'w1'},call);
  assert.equal(out.intent,'triage');
  assert.equal(out.cards[0].verdict,'GO');
  assert.deepEqual(out.trace.map((t)=>t.tool),['save_opportunity','next_best_action']);
  assert.match(out.reply,/That one fits/);
  assert.equal((await store.forWorkspace('w1').list()).length,1);
});

test('a SKIP listing is saved as skipped without being suggested',async()=>{
  const {store,call}=setup();
  const out=await converse({utterance:'Worth it?',title:'Live final',listing:SKIP,workspace:'w1'},call);
  assert.equal(out.cards[0].verdict,'SKIP');
  assert.ok(out.trace.some((t)=>t.tool==='set_opportunity_status'));
  const [item]=await store.forWorkspace('w1').list();
  assert.equal(item.status,'skipped');
  const next=await converse({utterance:'What should I work on today?',workspace:'w1'},call);
  assert.match(next.reply,/queue is empty/);
});

test('a later session is greeted with the saved pipeline',async()=>{
  const {call}=setup();
  await converse({title:'Build With AI',listing:GO,workspace:'w1'},call);
  await converse({title:'Help Wanted',listing:REVIEW,workspace:'w1'},call);
  const out=await converse({utterance:'Alexa, open BountyPilot',workspace:'w1'},call);
  assert.match(out.reply,/Welcome back\. You have 2 open opportunities/);
  assert.match(out.reply,/Build With AI/);
  assert.equal(out.cards[0].type,'queue');
});

test('status and plan intents act on the named or top opportunity',async()=>{
  const {store,call}=setup();
  await converse({title:'Build With AI',listing:GO,workspace:'w1'},call);
  await converse({title:'Help Wanted',listing:REVIEW,workspace:'w1'},call);

  const plan=await converse({utterance:'Plan the help wanted one',workspace:'w1'},call);
  assert.equal(plan.cards[0].type,'plan');
  assert.equal(plan.cards[0].title,'Help Wanted');

  const done=await converse({utterance:'I submitted it',workspace:'w1'},call);
  assert.match(done.reply,/Build With AI is now submitted/);
  assert.match(done.reply,/Next up: Help Wanted/);

  const items=await store.forWorkspace('w1').list();
  assert.equal(items.find((i)=>i.title==='Build With AI').status,'submitted');
});

test('workspaces do not leak between conversations',async()=>{
  const {call}=setup();
  await converse({title:'Build With AI',listing:GO,workspace:'alice'},call);
  const bob=await converse({utterance:'What is in my queue?',workspace:'bob'},call);
  assert.match(bob.reply,/Nothing open/);
});

test('unknown requests get a help reply',async()=>{
  const {call}=setup();
  const out=await converse({utterance:'sing me a song',workspace:'w1'},call);
  assert.equal(out.intent,'help');
});
test('daily briefing prioritizes actionable work ahead of submitted work',async()=>{
  const {call}=setup();
  await converse({title:'Big Prize',listing:GO,workspace:'w1'},call);
  await converse({
    title:'Smaller Async',
    listing:'$500 cash prize. Deadline: October 20, 2026. No interview required. Submit a GitHub repository and demo video.',
    workspace:'w1'
  },call);

  await converse({utterance:'I submitted the big prize one',workspace:'w1'},call);
  const out=await converse({utterance:'What should I work on today?',workspace:'w1'},call);

  assert.equal(out.intent,'next');
  assert.deepEqual(out.trace.map((step)=>step.tool),['get_opportunity_queue','daily_briefing']);
  assert.equal(out.cards[0].type,'briefing');
  assert.equal(out.cards[0].activeCount,2);
  assert.equal(out.cards[0].items[0].title,'Smaller Async');
  assert.equal(out.cards[0].items[1].title,'Big Prize');
  assert.match(out.reply,/Today's focus is Smaller Async/);
});

test('briefing card items is always an array, never null or undefined',async()=>{
  // Guards the null-guard added to renderBriefingCard in step 7:
  // card.items ?? [] must never be needed because the card produced by
  // converse() already guarantees an array -- but the renderer must also
  // survive a card where items is missing.
  const {call}=setup();
  await converse({title:'Build With AI',listing:GO,workspace:'w1'},call);
  const out=await converse({utterance:'What should I work on today?',workspace:'w1'},call);
  assert.equal(out.intent,'next');
  assert.equal(out.cards[0].type,'briefing');
  assert.ok(Array.isArray(out.cards[0].items),'briefing card items must be an Array');
  assert.ok(out.cards[0].items.length>0,'items must be non-empty when the queue has entries');
  for (const item of out.cards[0].items) {
    assert.ok(typeof item.title==='string','each item must carry a title string');
    assert.ok(typeof item.nextAction==='string','each item must carry a nextAction string');
  }
});

test('daily briefing with an empty queue replies with an empty-queue message and no card',async()=>{
  // Exercises the path that produces zero briefing items -- the renderer
  // null-guard must handle an empty items array, and converse() must not
  // produce a briefing card at all in this case.
  const {call}=setup();
  const out=await converse({utterance:'What should I work on today?',workspace:'w1'},call);
  assert.equal(out.intent,'next');
  assert.equal(out.cards.length,0,'no briefing card should be emitted for an empty queue');
  assert.match(out.reply,/queue is empty/);
});
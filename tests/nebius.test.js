import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {InMemoryTransport} from '@modelcontextprotocol/server';
import {OpportunityStore} from '../src/store.js';
import {MemoryBackend} from '../src/backends.js';
import {buildMcpServer} from '../src/mcp.js';
import {converse} from '../src/conversation.js';
import {analyzeOpportunity} from '../src/analyzer.js';
import {verifyExtraction, extractWithModel} from '../src/extractor.js';
import {nebiusFromEnv, tavilyFromEnv, parseJsonObject} from '../src/providers.js';
import {checkLiveness} from '../src/liveness.js';

const empty={quote:null};
const blank={
  reward:{...empty,text:null,amountUsd:null},
  deadline:{...empty,text:null},
  liveGate:{...empty,present:false},
  preHireGate:{...empty,present:false},
  unpaid:{...empty,present:false},
  submissionPath:{...empty,text:null},
  eligibility:{...empty,text:null}
};
const fakeLlm=(data)=>({name:'fake-llm',model:'nvidia/test',chatJSON:async()=>({data,usage:null,model:'nvidia/test'})});

function json(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}

function mcpCaller(store,providers) {
  return async(name,args)=>{
    const [c,s]=InMemoryTransport.createLinkedPair();
    const server=buildMcpServer(store,providers);
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

const LISTING='Agent Build Week. Prize pool: 2,000 USDC for the winner. Entries close on the last Friday of October. Finalists present their project on a video call with the judges. Submit through the Devpost form.';

test('model fields survive only when their quote is in the listing',()=>{
  const raw={...blank,
    liveGate:{present:true,quote:'Finalists present their project on a video call with the judges'},
    reward:{text:'$5,000',amountUsd:5000,quote:'Grand prize of $5,000'}};
  const {verified,rejected}=verifyExtraction(raw,LISTING);
  assert.deepEqual(Object.keys(verified),['liveGate']);
  assert.equal(rejected[0].field,'reward');
});

test('a verified model live gate turns a listing the rules missed into SKIP',async()=>{
  const rules=analyzeOpportunity({title:'Agent Build Week',listing:LISTING});
  assert.equal(rules.signals.liveGate,false,'the regexes do not know "video call with the judges"');

  const extraction=await extractWithModel({title:'Agent Build Week',listing:LISTING},fakeLlm({...blank,
    liveGate:{present:true,quote:'Finalists present their project on a video call with the judges'},
    reward:{text:'2,000 USDC',amountUsd:2000,quote:'2,000 USDC'},
    deadline:{text:'the last Friday of October',quote:'Entries close on the last Friday of October'}}));
  const a=analyzeOpportunity({title:'Agent Build Week',listing:LISTING},extraction);
  assert.equal(a.verdict,'SKIP');
  assert.match(a.deadline,/last Friday of October/);
  assert.ok(a.evidence.some((e)=>e.label==='Live gate' && e.source==='nemotron'));
  assert.equal(a.engine.model,'nvidia/test');
});

test('"submit a pull request" is not read as a deadline',()=>{
  const a=analyzeOpportunity({title:'T',listing:'Reward: $1,500. Submit a pull request with adversarial accuracy tests.'});
  assert.equal(a.deadline,null);
  assert.equal(analyzeOpportunity({title:'T',listing:'$300. Submissions close October 12. Open a GitHub PR.'}).deadline,'October 12');
});

test('the model cannot clear a blocker the rules found',async()=>{
  const listing='$500 challenge. Submit a GitHub repository. Shortlisted developers must complete a live technical interview on Zoom.';
  const extraction=await extractWithModel({title:'X',listing},fakeLlm({...blank,liveGate:{present:false,quote:null}}));
  assert.equal(analyzeOpportunity({title:'X',listing},extraction).verdict,'SKIP');
});

test('the Nebius client calls Token Factory with a JSON schema and reads fenced JSON',async()=>{
  let seen;
  const llm=nebiusFromEnv({NEBIUS_API_KEY:'k',NEBIUS_MODEL:'nvidia/some-nemotron'},async(url,init)=>{
    seen={url,init,body:JSON.parse(init.body)};
    return json({model:'nvidia/some-nemotron',choices:[{message:{content:'```json\n{"ok":true}\n```'}}]});
  });
  const out=await llm.chatJSON({system:'s',user:'u',schema:{type:'object'}});
  assert.equal(seen.url,'https://api.tokenfactory.nebius.com/v1/chat/completions');
  assert.equal(seen.init.headers.authorization,'Bearer k');
  assert.equal(seen.body.model,'nvidia/some-nemotron');
  assert.equal(seen.body.response_format.type,'json_schema');
  assert.deepEqual(out.data,{ok:true});
  assert.equal(nebiusFromEnv({}),null);
  assert.throws(()=>parseJsonObject('no json here'));
});

test('analysis falls back to the rules and says so when the model call fails',async()=>{
  const store=new OpportunityStore(new MemoryBackend());
  const broken={name:'nebius-token-factory',model:'m',chatJSON:async()=>{throw new Error('401 bad key');}};
  const call=mcpCaller(store,{llm:broken});
  const out=await call('analyze_opportunity',{title:'T',listing:LISTING});
  const engine=out.response.structuredContent.analysis.engine;
  assert.equal(engine.extractor,'rules');
  assert.match(engine.error,/401/);
});

function githubFake({state='open',assignees=[],comments=3,prs=[],labels=[]}) {
  return async(url)=>{
    if (url.endsWith('/timeline?per_page=100')) {
      return json(prs.map((p)=>({event:'cross-referenced',source:{issue:{title:p.title,html_url:p.url,state:p.state,user:{login:'dev'},pull_request:{merged_at:null}}}})));
    }
    return json({state,closed_at:state==='closed'?'2026-10-01T00:00:00Z':null,comments,labels:labels.map((name)=>({name})),assignees:assignees.map((login)=>({login}))});
  };
}

test('GitHub liveness reads closed, assigned and contested issues from the API',async()=>{
  const url='https://github.com/acme/app/issues/42';
  assert.equal((await checkLiveness({url},{fetchImpl:githubFake({state:'closed'})})).status,'CLOSED');
  const claimed=await checkLiveness({url},{fetchImpl:githubFake({assignees:['someone']})});
  assert.equal(claimed.status,'CLAIMED');
  assert.match(claimed.summary,/someone/);
  const contested=await checkLiveness({url},{fetchImpl:githubFake({prs:[{title:'fix',url:'https://github.com/acme/app/pull/43',state:'open'}]})});
  assert.equal(contested.status,'CONTESTED');
  assert.equal(contested.competition[0].url,'https://github.com/acme/app/pull/43');
  assert.equal((await checkLiveness({url},{fetchImpl:githubFake({})})).status,'OPEN');
  // Expensify-style: staff are assigned while the issue still asks for outside help.
  const helpWanted=await checkLiveness({url},{fetchImpl:githubFake({assignees:['staff'],labels:['Help Wanted'],comments:35})});
  assert.equal(helpWanted.status,'CONTESTED');
  assert.match(helpWanted.summary,/35 comments/);
});

test('page liveness uses Tavily text and ignores a model quote that is not on the page',async()=>{
  const page=(text)=>({name:'tavily',extract:async(u)=>({url:u,text}),search:async()=>[{title:'Someone else',url:'https://github.com/x/y/pull/1',snippet:''}]});
  const closed=await checkLiveness({url:'https://example.com/bounty',title:'Bounty'},{tavily:page('Thanks everyone! Submissions are now closed and judging has started.')});
  assert.equal(closed.status,'CLOSED');
  assert.match(closed.evidence[0].quote,/Submissions are now closed/);

  const filler='Build an agent that helps teams ship faster. '.repeat(10);
  const lying=fakeLlm({status:'CLOSED',quote:'This program has been discontinued'});
  const silent=await checkLiveness({url:'https://example.com/b2',title:'B2'},{tavily:page(filler),llm:lying});
  assert.equal(silent.status,'UNKNOWN','no quote either way is not evidence of open');
  assert.equal(silent.competition.length,1);

  const open=await checkLiveness({url:'https://example.com/b4'},{tavily:page('Life After Code. Registration is now open. Submissions open on October 5th.')});
  assert.equal(open.status,'OPEN');
  assert.equal(open.evidence[0].quote,'Registration is now open.');

  const honest=fakeLlm({status:'OPEN',quote:'We are accepting entries until the 30th'});
  const byModel=await checkLiveness({url:'https://example.com/b5'},{tavily:page(`${filler} We are accepting entries until the 30th. ${filler}`),llm:honest});
  assert.equal(byModel.status,'OPEN');

  const none=await checkLiveness({url:'https://example.com/b3'},{});
  assert.equal(none.status,'UNKNOWN');
});

test('the Tavily client sends a bearer key and maps search results',async()=>{
  let seen;
  const tavily=tavilyFromEnv({TAVILY_API_KEY:'tvly-x'},async(url,init)=>{
    seen={url,headers:init.headers};
    return json({results:[{title:'A',url:'https://a',content:'c'}]});
  });
  const results=await tavily.search('q');
  assert.equal(seen.url,'https://api.tavily.com/search');
  assert.equal(seen.headers.authorization,'Bearer tvly-x');
  assert.deepEqual(results,[{title:'A',url:'https://a',snippet:'c'}]);
});

test('triage skips a listing whose GitHub issue is already assigned',async()=>{
  const store=new OpportunityStore(new MemoryBackend());
  const call=mcpCaller(store,{fetchImpl:githubFake({assignees:['jasondavies']})});
  const listing='[Bounty $1,500] Improve div_no_nan accuracy. Submit a pull request on GitHub. No interview. https://github.com/acme/app/issues/58228';
  const out=await converse({utterance:'is this worth building?',listing,workspace:'w'},call);
  assert.match(out.reply,/claimed/);
  assert.equal(out.cards[0].type,'liveness','the deciding check is shown first');
  assert.equal(out.cards[0].status,'CLAIMED');
  const queue=await store.forWorkspace('w').list();
  assert.equal(queue[0].status,'skipped');
  assert.equal(queue[0].sourceUrl,'https://github.com/acme/app/issues/58228');
});

test('"is it still open?" checks the saved listing URL',async()=>{
  const store=new OpportunityStore(new MemoryBackend());
  const call=mcpCaller(store,{fetchImpl:githubFake({})});
  await converse({utterance:'check',listing:'$300 bounty. Submit a GitHub pull request. No interview required. https://github.com/acme/app/issues/7',workspace:'w'},call);
  const out=await converse({utterance:'Is it still open?',workspace:'w'},call);
  assert.equal(out.intent,'liveness');
  assert.match(out.reply,/^.*open\./);
});

test('the daily budget stops calls past the limit and resets the next day',async()=>{
  const {dailyBudget}=await import('../src/guard.js');
  let t=Date.parse('2026-10-06T10:00:00Z');
  let calls=0;
  const llm=dailyBudget({name:'nebius-token-factory',model:'m',chatJSON:async()=>{calls+=1;return {data:{}};}},2,()=>t);
  await llm.chatJSON({});
  await llm.chatJSON({});
  await assert.rejects(llm.chatJSON({}),/budget of 2/);
  t+=24*3600*1000;
  await llm.chatJSON({});
  assert.equal(calls,3);
  assert.equal(llm.model,'m');
});

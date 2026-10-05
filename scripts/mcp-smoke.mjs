import {Client, StreamableHTTPClientTransport} from '@modelcontextprotocol/client';

const base=process.env.BOUNTYPILOT_URL || 'http://127.0.0.1:4310';
const expectedTools=[
  'analyze_opportunity',
  'save_opportunity',
  'get_opportunity_queue',
  'compare_opportunities',
  'build_submission_plan',
  'set_opportunity_status',
  'daily_briefing',
  'next_best_action',
  'check_liveness'
].sort();

const client=new Client(
  {name:'bountypilot-smoke',version:'0.3.0'},
  {versionNegotiation:{mode:'auto'}}
);
const transport=new StreamableHTTPClientTransport(new URL(`${base}/mcp`));

try {
  await client.connect(transport);
  const listed=await client.listTools();
  const tools=listed.tools.map((tool)=>tool.name).sort();
  const missingTools=expectedTools.filter((name)=>!tools.includes(name));

  const analyzed=await client.callTool({
    name:'analyze_opportunity',
    arguments:{
      title:'Smoke Test Bounty',
      listing:'$500 cash bounty. Deadline: October 20. No interview required. Submit a public GitHub repository and demo video.'
    }
  });

  const briefing=await client.callTool({
    name:'daily_briefing',
    arguments:{workspace:'smoke-proof',limit:3}
  });

  const protocolVersion=client.getNegotiatedProtocolVersion?.() ?? 'unknown';
  const protocolEra=client.getProtocolEra?.() ?? 'unknown';
  const verdict=analyzed.structuredContent?.analysis?.verdict ?? null;
  const score=analyzed.structuredContent?.analysis?.score ?? null;
  const briefingPriorities=briefing.structuredContent?.priorities ?? [];
  const pass=
    protocolVersion!=='unknown'
    && missingTools.length===0
    && verdict==='GO'
    && Number.isFinite(score)
    && Array.isArray(briefingPriorities);

  const receipt={
    schema:'bountypilot-smoke/v2',
    endpoint:`${base}/mcp`,
    protocolVersion,
    protocolEra,
    toolCount:tools.length,
    tools,
    missingTools,
    analyzed:{verdict,score},
    briefing:{priorityCount:briefingPriorities.length},
    pass
  };

  console.log(JSON.stringify(receipt,null,2));
  if (!pass) process.exitCode=2;
} finally {
  await client.close();
}

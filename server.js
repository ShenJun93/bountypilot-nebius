import express from 'express';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {InMemoryTransport} from '@modelcontextprotocol/server';
import {toNodeHandler} from '@modelcontextprotocol/node';
import {OpportunityStore} from './src/store.js';
import {assertWorkspace, backendFromEnv} from './src/backends.js';
import {buildMcpServer, createBountyPilotHandler} from './src/mcp.js';
import {converse} from './src/conversation.js';
import {nebiusFromEnv, tavilyFromEnv} from './src/providers.js';

const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT || 4310);
const isVercel=Boolean(process.env.VERCEL);

const backend=backendFromEnv(process.env,{
  isVercel,
  defaultFile:join(root,'data','state.json'),
  tmpFile:join(tmpdir(),'bountypilot-state.json')
});
const store=new OpportunityStore(backend);
const providers={
  llm:nebiusFromEnv(process.env),
  tavily:tavilyFromEnv(process.env),
  githubToken:process.env.GITHUB_TOKEN || null
};
const engines={
  extractor:providers.llm ? `nemotron (${providers.llm.model}) via Nebius Token Factory` : 'rules only (NEBIUS_API_KEY not set)',
  liveness:['github-api',...(providers.tavily ? ['tavily'] : [])]
};
const mcpNodeHandler=toNodeHandler(createBountyPilotHandler(store,providers));

function structured(call) {
  return call.response?.structuredContent ?? call.response?.content?.[0]?.text ?? null;
}

// The simulator is an ordinary MCP client: it never calls the store directly.
async function callMcpTool(name,args={}) {
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  const server=buildMcpServer(store,providers);
  const client=new Client(
    {name:'bountypilot-web-client',version:'0.3.0'},
    {versionNegotiation:{mode:'auto'}}
  );

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);
    const response=await client.callTool({name,arguments:args});
    if (response.isError) throw new Error(response.content?.[0]?.text ?? `${name} failed`);
    return {transport:'in-memory-mcp',response};
  } finally {
    await Promise.allSettled([client.close(),server.close()]);
  }
}

function workspaceFrom(value) {
  return assertWorkspace(typeof value==='string' && value ? value : 'default');
}

const app=express();

// Keep the public Streamable HTTP MCP route ahead of body-parsing middleware.
app.all('/mcp',async (req,res)=>{
  try {
    await mcpNodeHandler(req,res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({error:error instanceof Error?error.message:String(error)});
    }
  }
});

app.use(express.json({limit:'256kb'}));

app.post('/api/converse',async (req,res,next)=>{
  try {
    const body=req.body ?? {};
    res.json(await converse({
      utterance:String(body.utterance ?? ''),
      title:String(body.title ?? ''),
      listing:String(body.listing ?? ''),
      workspace:workspaceFrom(body.workspace)
    },callMcpTool));
  } catch (error) {
    next(error);
  }
});

app.get('/api/queue',async (req,res,next)=>{
  try {
    const queue=await callMcpTool('get_opportunity_queue',{workspace:workspaceFrom(req.query.workspace)});
    res.json({queue:structured(queue),transport:queue.transport});
  } catch (error) {
    next(error);
  }
});

app.post('/api/reset',async (req,res,next)=>{
  try {
    await store.forWorkspace(workspaceFrom(req.body?.workspace)).reset();
    res.json({ok:true});
  } catch (error) {
    next(error);
  }
});

app.get('/health',(_req,res)=>{
  res.json({status:'ok',service:'bountypilot',transport:'streamable-http',state:store.storageKind,engines});
});

app.use(express.static(join(root,'public'),{
  etag:true,
  maxAge:0,
  setHeaders(res){res.setHeader('cache-control','no-store');}
}));

app.use((error,_req,res,_next)=>{
  const status=/workspace must be/.test(error?.message ?? '') ? 400 : 500;
  res.status(status).json({error:error instanceof Error?error.message:String(error)});
});

if (!isVercel) {
  app.listen(port,'127.0.0.1',()=>{
    console.log(`BountyPilot MCP + web client: http://127.0.0.1:${port}`);
    console.log(`MCP endpoint: http://127.0.0.1:${port}/mcp`);
    console.log(`State: ${store.storageKind}`);
    console.log(`Extractor: ${engines.extractor}; liveness: ${engines.liveness.join(', ')}`);
  });
}

export default app;

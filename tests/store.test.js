import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {OpportunityStore} from '../src/store.js';
import {FileBackend, MemoryBackend, RedisRestBackend, backendFromEnv} from '../src/backends.js';

async function withTempDir(fn) {
  const dir=await mkdtemp(join(tmpdir(),'bountypilot-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
}

test('queue persists across store instances and orders higher score first',async()=>{
  await withTempDir(async(dir)=>{
    const file=join(dir,'state.json');
    const store=new OpportunityStore(new FileBackend(file));
    const low=await store.saveOpportunity({title:'Low',listing:'low',analysis:{score:55,verdict:'REVIEW'}});
    const high=await store.saveOpportunity({title:'High',listing:'high',analysis:{score:91,verdict:'GO'}});

    const list=await store.list();
    assert.equal(list[0].id,high.id);
    assert.equal(list[1].id,low.id);

    await store.updateStatus(high.id,'submitted');
    const reopened=new OpportunityStore(new FileBackend(file));
    assert.equal((await reopened.get(high.id)).status,'submitted');
  });
});

test('workspaces are isolated from each other',async()=>{
  const store=new OpportunityStore(new MemoryBackend());
  const alice=store.forWorkspace('alice');
  const bob=store.forWorkspace('bob');
  await alice.saveOpportunity({title:'A',listing:'a',analysis:{score:80,verdict:'GO'}});
  assert.equal((await alice.list()).length,1);
  assert.equal((await bob.list()).length,0);
});

test('invalid workspace ids are rejected',()=>{
  const store=new OpportunityStore(new MemoryBackend());
  assert.throws(()=>store.forWorkspace('../etc'),/workspace must be/);
  assert.throws(()=>store.forWorkspace(''),/workspace must be/);
});

test('a v0.1 single-queue file is read as the default workspace',async()=>{
  await withTempDir(async(dir)=>{
    const file=join(dir,'state.json');
    await writeFile(file,JSON.stringify({profile:{name:'Old'},opportunities:[{id:'x',title:'Old item',status:'candidate',analysis:{score:1}}]}));
    const store=new OpportunityStore(new FileBackend(file));
    assert.equal((await store.list())[0].title,'Old item');
    await store.saveOpportunity({title:'New',listing:'n',analysis:{score:2}});
    const written=JSON.parse(await readFile(file,'utf8'));
    assert.equal(written.workspaces.default.opportunities.length,2);
  });
});

test('Redis REST backend sends GET/SET commands and round-trips state',async()=>{
  const db=new Map();
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,auth:init.headers.authorization,body:JSON.parse(init.body)});
    const [cmd,key,value]=JSON.parse(init.body);
    if (cmd==='SET') db.set(key,value);
    const result=cmd==='GET' ? (db.get(key) ?? null) : 'OK';
    return {ok:true,json:async()=>({result})};
  };
  const backend=new RedisRestBackend({url:'https://example.upstash.io/',token:'t0k',fetchImpl});
  assert.equal(await backend.load('ws1'),null);
  await backend.save('ws1',{profile:{},opportunities:[{id:'1'}]});
  assert.deepEqual(await backend.load('ws1'),{profile:{},opportunities:[{id:'1'}]});
  assert.equal(calls[0].url,'https://example.upstash.io');
  assert.equal(calls[0].auth,'Bearer t0k');
  assert.deepEqual(calls[1].body.slice(0,2),['SET','bountypilot:ws:ws1']);
});

test('Redis REST backend echoes the Upstash sync token for read-your-writes',async()=>{
  const seen=[];
  let n=0;
  const fetchImpl=async(_url,init)=>{
    seen.push(init.headers['upstash-sync-token'] ?? null);
    n+=1;
    return {ok:true,headers:{get:(h)=>h==='upstash-sync-token'?`tok-${n}`:null},json:async()=>({result:null})};
  };
  const backend=new RedisRestBackend({url:'https://x',token:'t',fetchImpl});
  await backend.save('ws',{opportunities:[]});
  await backend.load('ws');
  await backend.load('ws');
  assert.deepEqual(seen,[null,'tok-1','tok-2']);
});

test('Redis REST backend surfaces errors instead of returning empty state',async()=>{
  const fetchImpl=async()=>({ok:false,status:401,json:async()=>({error:'WRONGPASS'})});
  const backend=new RedisRestBackend({url:'https://x',token:'bad',fetchImpl});
  await assert.rejects(backend.load('ws'),/WRONGPASS/);
});

test('backend selection prefers Redis, then an explicit file, then Vercel tmp',()=>{
  const opts={isVercel:true,defaultFile:'/d.json',tmpFile:'/tmp/t.json'};
  assert.equal(backendFromEnv({KV_REST_API_URL:'https://kv',KV_REST_API_TOKEN:'t'},opts).kind,'redis-durable');
  assert.equal(backendFromEnv({UPSTASH_REDIS_REST_URL:'https://u',UPSTASH_REDIS_REST_TOKEN:'t'},opts).kind,'redis-durable');
  const prefixed=backendFromEnv({
    kv_KV_REST_API_URL:'https://p.upstash.io',
    kv_KV_REST_API_TOKEN:'rw',
    kv_KV_REST_API_READ_ONLY_TOKEN:'ro'
  },opts);
  assert.equal(prefixed.kind,'redis-durable');
  assert.equal(prefixed.token,'rw');
  assert.equal(backendFromEnv({kv_KV_REST_API_URL:'https://p'},opts).kind,'ephemeral-vercel-tmp');
  assert.equal(backendFromEnv({BOUNTYPILOT_STATE:'/s.json'},opts).filePath,'/s.json');
  assert.equal(backendFromEnv({},opts).kind,'ephemeral-vercel-tmp');
  assert.equal(backendFromEnv({},{...opts,isVercel:false}).kind,'local-file');
});

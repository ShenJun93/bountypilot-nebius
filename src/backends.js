import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export const WORKSPACE_PATTERN=/^[A-Za-z0-9_-]{1,64}$/;

export function assertWorkspace(id) {
  if (!WORKSPACE_PATTERN.test(id)) throw new Error('workspace must be 1-64 characters of A-Z, a-z, 0-9, _ or -');
  return id;
}

export class MemoryBackend {
  kind='memory';
  #data=new Map();

  async load(workspace) {
    const value=this.#data.get(workspace);
    return value ? structuredClone(value) : null;
  }

  async save(workspace,state) {
    this.#data.set(workspace,structuredClone(state));
  }
}

export class FileBackend {
  constructor(filePath,{kind='local-file'}={}) {
    this.filePath=filePath;
    this.kind=kind;
  }

  async #readAll() {
    await mkdir(dirname(this.filePath),{recursive:true});
    let raw;
    try {
      raw=JSON.parse(await readFile(this.filePath,'utf8'));
    } catch (error) {
      if (error?.code==='ENOENT') return {workspaces:{}};
      throw error;
    }
    // v0.1 files held a single queue at the top level.
    if (!raw.workspaces) return {workspaces:{default:{profile:raw.profile,opportunities:raw.opportunities ?? []}}};
    return raw;
  }

  async load(workspace) {
    return (await this.#readAll()).workspaces[workspace] ?? null;
  }

  async save(workspace,state) {
    const all=await this.#readAll();
    all.workspaces[workspace]=state;
    await writeFile(this.filePath,JSON.stringify(all,null,2));
  }
}

export class RedisRestBackend {
  kind='redis-durable';

  constructor({url,token,prefix='bountypilot:ws:',fetchImpl=globalThis.fetch}) {
    this.url=url.replace(/\/$/,'');
    this.token=token;
    this.prefix=prefix;
    this.fetch=fetchImpl;
  }

  #syncToken=null;

  async #command(args) {
    const headers={authorization:`Bearer ${this.token}`,'content-type':'application/json'};
    // Upstash may serve a read from a replica; echoing the last sync token gives read-your-writes.
    if (this.#syncToken) headers['upstash-sync-token']=this.#syncToken;
    const response=await this.fetch(this.url,{method:'POST',headers,body:JSON.stringify(args)});
    this.#syncToken=response.headers?.get?.('upstash-sync-token') ?? this.#syncToken;
    const body=await response.json();
    if (!response.ok || body.error) throw new Error(`Redis REST error: ${body.error ?? response.status}`);
    return body.result;
  }

  async load(workspace) {
    const value=await this.#command(['GET',this.prefix+workspace]);
    return value ? JSON.parse(value) : null;
  }

  async save(workspace,state) {
    await this.#command(['SET',this.prefix+workspace,JSON.stringify(state)]);
  }
}

// Vercel's Upstash integration prepends a user-chosen prefix, e.g. kv_KV_REST_API_URL.
function redisRestCredentials(env) {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return {url:env.UPSTASH_REDIS_REST_URL,token:env.UPSTASH_REDIS_REST_TOKEN};
  }
  for (const key of Object.keys(env).sort()) {
    if (!key.endsWith('KV_REST_API_URL')) continue;
    const token=env[key.slice(0,-'URL'.length)+'TOKEN'];
    if (env[key] && token) return {url:env[key],token};
  }
  return null;
}

export function backendFromEnv(env,{defaultFile,isVercel,tmpFile}) {
  const redis=redisRestCredentials(env);
  if (redis) return new RedisRestBackend(redis);
  if (env.BOUNTYPILOT_STATE) return new FileBackend(env.BOUNTYPILOT_STATE);
  if (isVercel) return new FileBackend(tmpFile,{kind:'ephemeral-vercel-tmp'});
  return new FileBackend(defaultFile);
}

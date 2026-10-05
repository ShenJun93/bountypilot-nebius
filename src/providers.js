// Thin clients for the two hosted services. Both return null when their key is missing,
// so the app keeps working on the rule-based path and says which engine produced what.

export const NEBIUS_BASE_URL='https://api.tokenfactory.nebius.com/v1';
export const DEFAULT_NEBIUS_MODEL='nvidia/nemotron-3-super-120b-a12b';
const TAVILY_BASE_URL='https://api.tavily.com';

async function postJson(fetchImpl,url,headers,body,timeoutMs) {
  const res=await fetchImpl(url,{
    method:'POST',
    headers:{'content-type':'application/json',...headers},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(timeoutMs)
  });
  const text=await res.text();
  if (!res.ok) throw new Error(`${url} responded ${res.status}: ${text.slice(0,200)}`);
  return JSON.parse(text);
}

// Models sometimes wrap JSON in prose or a code fence even in JSON mode; take the outermost object.
export function parseJsonObject(text) {
  const start=text.indexOf('{');
  const end=text.lastIndexOf('}');
  if (start<0 || end<=start) throw new Error('model reply contained no JSON object');
  return JSON.parse(text.slice(start,end+1));
}

export function nebiusFromEnv(env=process.env,fetchImpl=fetch) {
  const apiKey=env.NEBIUS_API_KEY;
  if (!apiKey) return null;
  const model=env.NEBIUS_MODEL || DEFAULT_NEBIUS_MODEL;
  const baseUrl=(env.NEBIUS_BASE_URL || NEBIUS_BASE_URL).replace(/\/$/,'');
  return {
    name:'nebius-token-factory',
    model,
    async chatJSON({system,user,schema,schemaName='result'}) {
      const body={
        model,
        temperature:0,
        max_tokens:1500,
        messages:[{role:'system',content:system},{role:'user',content:user}],
        response_format:schema
          ? {type:'json_schema',json_schema:{name:schemaName,schema,strict:true}}
          : {type:'json_object'}
      };
      const out=await postJson(fetchImpl,`${baseUrl}/chat/completions`,{authorization:`Bearer ${apiKey}`},body,45000);
      const message=out.choices?.[0]?.message;
      if (!message?.content) throw new Error('Token Factory returned no message content');
      return {data:parseJsonObject(message.content),usage:out.usage ?? null,model:out.model ?? model};
    }
  };
}

export function tavilyFromEnv(env=process.env,fetchImpl=fetch) {
  const apiKey=env.TAVILY_API_KEY;
  if (!apiKey) return null;
  const headers={authorization:`Bearer ${apiKey}`};
  return {
    name:'tavily',
    async extract(url) {
      const out=await postJson(fetchImpl,`${TAVILY_BASE_URL}/extract`,headers,{urls:[url],extract_depth:'basic'},30000);
      const page=out.results?.[0];
      if (!page) throw new Error(out.failed_results?.[0]?.error ?? 'Tavily could not extract the page');
      return {url:page.url ?? url,text:page.raw_content ?? ''};
    },
    async search(query,{maxResults=5,includeDomains}={}) {
      const body={query,max_results:maxResults,search_depth:'basic'};
      if (includeDomains) body.include_domains=includeDomains;
      const out=await postJson(fetchImpl,`${TAVILY_BASE_URL}/search`,headers,body,30000);
      return (out.results ?? []).map((r)=>({title:r.title,url:r.url,snippet:(r.content ?? '').slice(0,300)}));
    }
  };
}

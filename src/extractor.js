// Model-assisted extraction with a hard evidence rule: every field Nemotron returns must
// carry a quote that appears word for word in the listing. Fields whose quote cannot be
// found are discarded and reported, never used.

const field=(extra={})=>({
  type:'object',
  additionalProperties:false,
  required:['quote',...Object.keys(extra)],
  properties:{quote:{type:['string','null']},...extra}
});

export const EXTRACTION_SCHEMA={
  type:'object',
  additionalProperties:false,
  required:['reward','deadline','liveGate','preHireGate','unpaid','submissionPath','eligibility'],
  properties:{
    reward:field({text:{type:['string','null']},amountUsd:{type:['number','null']}}),
    deadline:field({text:{type:['string','null']}}),
    liveGate:field({present:{type:'boolean'}}),
    preHireGate:field({present:{type:'boolean'}}),
    unpaid:field({present:{type:'boolean'}}),
    submissionPath:field({text:{type:['string','null']}}),
    eligibility:field({text:{type:['string','null']}})
  }
};

const SYSTEM=`You read bounty and hackathon listings for a solo developer who works asynchronously and cannot do live or spoken interviews.
Return JSON matching the schema. For every field, "quote" must be copied exactly, character for character, from the listing (a short span, under 200 characters), or null when the listing says nothing about it.
- reward: the cash prize or bounty. amountUsd only if the amount is stated in USD or USDC, else null.
- deadline: when submissions close, as written.
- liveGate.present: true only if a live call, interview, live demo or in-person attendance is REQUIRED. "No interview" means false.
- preHireGate.present: true if you must be selected, assigned or hired before you may start work.
- unpaid.present: true if it states there is no payment or prize.
- submissionPath: how work is submitted (pull request, Devpost, form...).
- eligibility: who may enter or which countries are excluded.
Do not infer anything that is not written. Never invent a quote.`;

const normalize=(s)=>s.toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();

export function quoteIsVerbatim(quote,listing) {
  if (typeof quote!=='string' || quote.trim().length<3) return false;
  return normalize(listing).includes(normalize(quote));
}

// Keeps only fields that are both asserted and backed by a verbatim quote.
export function verifyExtraction(raw,listing) {
  const verified={};
  const rejected=[];
  for (const key of Object.keys(EXTRACTION_SCHEMA.properties)) {
    const value=raw?.[key];
    if (!value) continue;
    const asserts=value.present===true || (typeof value.text==='string' && value.text.trim()) || Number.isFinite(value.amountUsd);
    if (!asserts) continue;
    if (quoteIsVerbatim(value.quote,listing)) verified[key]={...value,quote:value.quote.trim()};
    else rejected.push({field:key,quote:value.quote ?? null,reason:'quote not found in listing'});
  }
  return {verified,rejected};
}

export async function extractWithModel({title,listing},llm) {
  const text=`${title}\n${listing}`.trim();
  const started=Date.now();
  const {data,usage,model}=await llm.chatJSON({
    system:SYSTEM,
    user:`Listing:\n"""\n${text.slice(0,12000)}\n"""`,
    schema:EXTRACTION_SCHEMA,
    schemaName:'listing_extraction'
  });
  const {verified,rejected}=verifyExtraction(data,text);
  return {engine:llm.name,model,ms:Date.now()-started,usage,verified,rejected};
}

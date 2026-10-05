import {randomUUID} from 'node:crypto';
import {assertWorkspace} from './backends.js';

const defaultProfile={
  name:'Solo Builder',
  constraints:[
    'Prefer async code-submit workflows',
    'Avoid mandatory interviews and live assessments',
    'Prioritize near-term cashflow'
  ]
};

const terminal=['won','lost','skipped'];

function emptyState() {
  return {profile:defaultProfile,opportunities:[]};
}

export class OpportunityStore {
  constructor(backend,workspace='default') {
    this.backend=backend;
    this.workspace=assertWorkspace(workspace);
  }

  get storageKind() {
    return this.backend.kind;
  }

  forWorkspace(workspace) {
    return new OpportunityStore(this.backend,workspace);
  }

  async #state() {
    return (await this.backend.load(this.workspace)) ?? emptyState();
  }

  async #save(state) {
    await this.backend.save(this.workspace,state);
  }

  async getProfile() {
    return (await this.#state()).profile;
  }

  async saveOpportunity({title,listing,sourceUrl=null,analysis}) {
    const state=await this.#state();
    const now=new Date().toISOString();
    const item={id:randomUUID(),title,listing,sourceUrl,analysis,status:'candidate',createdAt:now,updatedAt:now};
    state.opportunities.push(item);
    await this.#save(state);
    return item;
  }

  async list() {
    const state=await this.#state();
    return [...state.opportunities].sort((a,b)=>{
      const inactive=(x)=>terminal.includes(x.status)?1:0;
      return inactive(a)-inactive(b) || (b.analysis?.score??0)-(a.analysis?.score??0);
    });
  }

  async get(id) {
    return (await this.#state()).opportunities.find((item)=>item.id===id) ?? null;
  }

  async updateStatus(id,status) {
    const state=await this.#state();
    const item=state.opportunities.find((entry)=>entry.id===id);
    if (!item) return null;
    item.status=status;
    item.updatedAt=new Date().toISOString();
    await this.#save(state);
    return item;
  }

  async reset() {
    const state=emptyState();
    await this.#save(state);
    return state;
  }
}

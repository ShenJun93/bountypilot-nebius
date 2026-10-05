import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeOpportunity} from '../src/analyzer.js';

test('GO for explicit async code-submit opportunity',()=>{
  const r=analyzeOpportunity({
    title:'Async challenge',
    listing:'$1,250 cash prize. Deadline: October 26, 2026. No interview required. Submit a GitHub repository and demo video.'
  });
  assert.equal(r.verdict,'GO');
  assert.equal(r.signals.liveGate,false);
  assert.equal(r.signals.codeSubmission,true);
  assert.ok(r.score>=72);
});

test('REVIEW when implementation requires pre-hire assignment',()=>{
  const r=analyzeOpportunity({
    title:'External bounty',
    listing:'$250 reward. Post a proposal and wait for assignment. Must be hired through Upwork before creating a pull request.'
  });
  assert.equal(r.verdict,'REVIEW');
  assert.equal(r.signals.preHireGate,true);
});

test('SKIP for live technical interview',()=>{
  const r=analyzeOpportunity({
    title:'Live gate',
    listing:'$500 prize. Submit GitHub code. Finalists must complete a live technical interview on Zoom.'
  });
  assert.equal(r.verdict,'SKIP');
  assert.equal(r.signals.liveGate,true);
});

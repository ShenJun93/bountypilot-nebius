import test from 'node:test';
import assert from 'node:assert/strict';
import {briefingItems,renderCardSafely} from '../public/render-guards.js';

test('briefingItems returns a safe empty list for missing or malformed items',()=>{
  assert.deepEqual(briefingItems({}),[]);
  assert.deepEqual(briefingItems({items:null}),[]);
  assert.deepEqual(briefingItems({items:{title:'not-an-array'}}),[]);
  assert.deepEqual(briefingItems({items:[{title:'ShipSignal'}]}),[{title:'ShipSignal'}]);
});

test('renderCardSafely skips unknown cards and contains renderer failures',()=>{
  assert.deepEqual(renderCardSafely({}, {type:'unknown'}),{node:null,error:null});

  const rendered={kind:'node'};
  assert.deepEqual(
    renderCardSafely({briefing:()=>rendered},{type:'briefing'}),
    {node:rendered,error:null}
  );

  assert.deepEqual(
    renderCardSafely({briefing:()=>{throw new Error('bad card');}},{type:'briefing'}),
    {node:null,error:'bad card'}
  );
});

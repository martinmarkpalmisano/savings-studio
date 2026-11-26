import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSavingsScenario,comparePair} from '../assets/comparison.mjs';

const fixed={initialBalance:60000,firstAER:4.2,accountType:'fixed',fixedTermMonths:48,
  fixedPayoutFrequency:'quarterly',taxRate:26,stampDuty:true,stampRate:0.2};
const flexible={initialBalance:60000,monthlyDeposit:0,firstAER:1,excessAER:1,accountType:'flexible',
  tieredInterest:false,creditFrequency:'daily',taxRate:26,stampDuty:false,startDate:'2026-11-26'};

test('fixed 48-month comparison net equals separately tested Cherry-style calculation',()=>{
  const result=compareSavingsScenario(fixed,48);
  assert.equal(result.netProfit,6979.2);
  assert.equal(result.closingWealth,66979.2);
  assert.equal(result.reinvestInterest,0);
});
test('fixed-term cannot be projected past maturity with invented renewal',()=>{
  const result=compareSavingsScenario({...fixed,fixedTermMonths:24},48);
  assert.equal(result.compatible,false);
});
test('side-by-side compares net profit over a common four-year horizon',()=>{
  const result=comparePair(fixed,flexible,48);
  assert.equal(result.comparable,true);
  assert.equal(result.equalContributions,true);
  assert.ok(result.difference>5000);
});
test('coupon reinvestment adds incremental profit without compounding locked principal',()=>{
  const no=compareSavingsScenario(fixed,48,0);
  const yes=compareSavingsScenario(fixed,48,3);
  assert.ok(yes.reinvestInterest>0);
  assert.equal(yes.netProfit,Math.round((no.netProfit+yes.reinvestInterest)*100)/100);
  assert.equal(yes.principal,60000);
});
test('flexible monthly contributions are counted within comparison horizon',()=>{
  const result=compareSavingsScenario({...flexible,monthlyDeposit:100,creditFrequency:'monthly'},24);
  assert.equal(result.totalContributions,62400);
  assert.ok(result.netProfit>0);
});
test('comparison flags unequal contributions for responsible interpretation',()=>{
  const result=comparePair(fixed,{...flexible,monthlyDeposit:150},24);
  assert.equal(result.comparable,true);
  assert.equal(result.equalContributions,false);
});
test('invalid comparison horizon and reinvestment rate are rejected',()=>{
  assert.throws(()=>compareSavingsScenario(flexible,0));
  assert.throws(()=>compareSavingsScenario(fixed,48,-1));
});

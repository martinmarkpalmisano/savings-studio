import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailySchedule,safeStartDate} from '../assets/daily.mjs';

test('daily statement produces all dates in a normal year',()=>{
  const p=buildDailySchedule({initialBalance:1000,years:1,startDate:'2026-01-01',firstAER:2.5,tieredInterest:false});
  assert.equal(p.days.length,365);
  assert.equal(p.months.length,12);
  assert.equal(p.days[0].date,'2026-01-01');
  assert.equal(p.days.at(-1).date,'2026-12-31');
  assert.equal(p.months[0].startDate,'2026-01-01');
  assert.equal(p.months[0].endDate,'2026-01-31');
});
test('daily interest follows 365/366 p.a. and 26 percent withholding',()=>{
  const p=buildDailySchedule({initialBalance:1000,years:1,startDate:'2026-01-01',firstAER:2.5,tieredInterest:false});
  assert.ok(Math.abs(p.days[0].interest-1000*.025/365)<1e-10);
  assert.ok(Math.abs(p.days[0].tax-p.days[0].interest*.26)<1e-10);
  assert.equal(p.days[0].netInterest,0.05);
});
test('2028 leap year includes leap day and 366 days',()=>{
  const p=buildDailySchedule({initialBalance:1000,years:1,startDate:'2028-01-01',firstAER:3,tieredInterest:false});
  assert.equal(p.days.length,366);
  assert.ok(p.days.some(m=>m.date==='2028-02-29'));
  assert.ok(Math.abs(p.days[0].interest-1000*.03/366)<1e-10);
});
test('daily totals reconcile with monthly summary and bank balance',()=>{
  const p=buildDailySchedule({initialBalance:18000,monthlyDeposit:75,threshold:15000,firstAER:3.5,excessAER:1.25,years:2,startDate:'2026-11-22',monthlyFeeEnabled:true,monthlyFee:9.99,stampDuty:true});
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  assert.equal(round(p.days.reduce((sum,m)=>sum+m.netInterest,0)),p.totalNetInterest);
  assert.equal(round(p.months.reduce((sum,m)=>sum+m.netInterest,0)),p.totalNetInterest);
  assert.equal(p.closingBalance,round(p.totalDeposits+p.totalNetInterest-p.totalStampDuty));
  assert.equal(p.netProfit,round(p.totalNetInterest-p.totalStampDuty-p.totalMonthlyFees));
  assert.equal(p.totalMonthlyFees,239.76);
  assert.equal(p.days.length>700,true);
});
test('small interest is carried until minimum cent threshold',()=>{
  const p=buildDailySchedule({initialBalance:5,years:1,startDate:'2026-01-01',firstAER:1,tieredInterest:false});
  assert.equal(p.days[0].netInterest,0);
  assert.ok(p.days.slice(0,90).every(x=>x.netInterest>=0));
  assert.ok(p.days.some(m=>m.netInterest===0.01));
});
test('single rate daily applies to full balance, including excess of threshold',()=>{
  const basic={initialBalance:20000,threshold:15000,firstAER:6.25,excessAER:1.25,years:1,startDate:'2026-01-01'};
  const single=buildDailySchedule({...basic,tieredInterest:false});
  const tiered=buildDailySchedule({...basic,tieredInterest:true});
  assert.equal(single.days[0].excessInterest,0);
  assert.ok(single.days[0].firstInterest>tiered.days[0].firstInterest);
  assert.equal(tiered.days[0].excessInterest,5000*.0125/365);
});
test('monthly subscription is external, separate from daily compounding',()=>{
  const s={initialBalance:20000,years:1,startDate:'2026-01-01'};
  const a=buildDailySchedule({...s,monthlyFeeEnabled:false});
  const b=buildDailySchedule({...s,monthlyFeeEnabled:true,monthlyFee:9.99});
  assert.equal(a.closingBalance,b.closingBalance);
  assert.equal(b.totalMonthlyFees,119.88);
  assert.equal(b.netProfit,Math.round((a.netProfit-119.88)*100)/100);
  assert.equal(b.days[30].monthlyFee,9.99);
  assert.equal(b.days[0].monthlyFee,0);
});
test('calendar date validation is predictable',()=>{
  assert.equal(safeStartDate('2028-02-29'),'2028-02-29');
  assert.equal(safeStartDate('2027-02-29'),'2026-11-22');
  assert.equal(safeStartDate('invalid'),'2026-11-22');
});

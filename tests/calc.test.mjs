import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSchedule,effectiveMonthlyRate,parseLocalizedNumber} from '../assets/calc.mjs';
test('AER compounds over 12 months',()=>{
  const r=effectiveMonthlyRate(3.5);
  assert.ok(Math.abs(Math.pow(1+r,12)-1.035)<1e-12);
});
test('twenty thousand splits interest across tiers',()=>{
  const p=buildSchedule({initialBalance:20000,years:1,taxRate:0});
  assert.equal(p.months[0].firstInterest,43.06);
  assert.equal(p.months[0].excessInterest,5.18);
  assert.equal(p.months[0].interest,48.24);
  assert.equal(p.months[0].closingBalance,20048.24);
});
test('below threshold earns no excess interest',()=>{
  const p=buildSchedule({initialBalance:1000,years:1});
  assert.ok(p.months.every(x=>x.excessInterest===0));
});
test('month end deposit starts earning next month',()=>{
  const p=buildSchedule({initialBalance:10000,monthlyDeposit:500,years:1,taxRate:0});
  assert.equal(p.months[0].firstInterest,28.71);
  assert.equal(p.months[0].closingBalance,10528.71);
  assert.equal(p.months[1].openingBalance,10528.71);
  assert.equal(p.totalDeposits,16000);
});
test('first tier remains capped above threshold',()=>{
  const p=buildSchedule({initialBalance:50000,years:1});
  assert.equal(p.months[0].firstTierBalance,15000);
  assert.equal(p.months[0].excessTierBalance,35000);
  assert.equal(p.firstExceedMonth,0);
});
test('zero AER produces deposits only',()=>{
  const p=buildSchedule({initialBalance:20000,monthlyDeposit:100,firstAER:0,excessAER:0,years:2});
  assert.equal(p.totalInterest,0);
  assert.equal(p.closingBalance,22400);
});
test('total interest reconciles to final balance',()=>{
  const p=buildSchedule({initialBalance:14500,monthlyDeposit:150,years:5,taxRate:0});
  assert.equal(Math.round((p.closingBalance-p.totalDeposits)*100),Math.round(p.totalInterest*100));
  assert.equal(p.months.length,60);
});
test('Italian default withholds 26 percent on each monthly credit',()=>{
  const p=buildSchedule({initialBalance:20000,years:1});
  assert.equal(p.months[0].interest,48.24);
  assert.equal(p.months[0].tax,12.54);
  assert.equal(p.months[0].netInterest,35.70);
  assert.equal(p.months[0].closingBalance,20035.70);
  assert.ok(p.grossClosingBalance>p.closingBalance);
});
test('tax withholding and stamp duty reconcile to net account growth',()=>{
  const p=buildSchedule({initialBalance:14500,monthlyDeposit:150,years:5,stampDuty:true});
  assert.equal(p.netProfit,Math.round((p.closingBalance-p.totalDeposits)*100)/100);
  assert.equal(p.totalInterest,Math.round((p.totalNetInterest+p.totalTax)*100)/100);
});
test('optional stamp duty applies at year-end only',()=>{
  const p=buildSchedule({initialBalance:20000,years:2,stampDuty:true});
  const baseline=buildSchedule({initialBalance:20000,years:2,stampDuty:false});
  assert.equal(p.months.filter(m=>m.stampDuty>0).length,2);
  assert.ok(p.months[11].stampDuty>0);
  assert.ok(p.months[23].stampDuty>0);
  assert.ok(p.closingBalance<baseline.closingBalance);
});
test('stamp duty is not charged unless enabled',()=>{
  assert.equal(buildSchedule({years:3}).totalStampDuty,0);
});
test('defaults are euro and Italian bank interest withholding',()=>{
  const p=buildSchedule();
  assert.equal(p.settings.currency,'EUR');
  assert.equal(p.settings.taxRate,26);
});

test('Italian decimal comma accepted in interest rates',()=>{
  assert.equal(parseLocalizedNumber('3,5'),3.5);
  assert.equal(parseLocalizedNumber('1,25'),1.25);
  assert.equal(parseLocalizedNumber('26,5'),26.5);
});
test('Dot decimals and common thousands separators are accepted',()=>{
  assert.equal(parseLocalizedNumber('3.5'),3.5);
  assert.equal(parseLocalizedNumber('15.000,75','money'),15000.75);
  assert.equal(parseLocalizedNumber('15,000.75','money'),15000.75);
  assert.equal(parseLocalizedNumber('15.000','money'),15000);
});
test('Invalid localized inputs are rejected',()=>{
  assert.ok(Number.isNaN(parseLocalizedNumber('3,,5')));
  assert.ok(Number.isNaN(parseLocalizedNumber('')));
  assert.ok(Number.isNaN(parseLocalizedNumber('hello')));
});

test('single-rate mode applies the first AER to the entire balance',()=>{
  const p=buildSchedule({initialBalance:20000,threshold:15000,firstAER:6.25,excessAER:1.25,tieredInterest:false,years:1,taxRate:0});
  const expected=Math.round(20000*effectiveMonthlyRate(6.25)*100)/100;
  assert.equal(p.months[0].firstInterest,expected);
  assert.equal(p.months[0].excessInterest,0);
  assert.equal(p.months[0].firstTierBalance,20000);
  assert.equal(p.months[0].excessTierBalance,0);
  assert.equal(p.months[0].interest,expected);
  assert.equal(p.firstExceedMonth,null);
  assert.ok(p.months.every(m=>m.excessInterest===0));
});
test('single-rate mode preserves tax and compounding',()=>{
  const p=buildSchedule({initialBalance:20000,tieredInterest:false,firstAER:6.25,years:2});
  assert.equal(p.months[0].tax,Math.round(p.months[0].interest*.26*100)/100);
  assert.equal(p.months[1].openingBalance,p.months[0].closingBalance);
  assert.equal(Math.round((p.closingBalance-p.totalDeposits)*100),Math.round(p.netProfit*100));
  assert.ok(p.grossClosingBalance>p.closingBalance);
});
test('enabling tiers restores the threshold and excess rate without changing those inputs',()=>{
  const settings={initialBalance:20000,threshold:15000,firstAER:6.25,excessAER:1.25,years:1,taxRate:0};
  const single=buildSchedule({...settings,tieredInterest:false});
  const tiered=buildSchedule({...settings,tieredInterest:true});
  assert.equal(single.settings.threshold,tiered.settings.threshold);
  assert.equal(single.settings.excessAER,tiered.settings.excessAER);
  assert.equal(tiered.months[0].firstTierBalance,15000);
  assert.equal(tiered.months[0].excessTierBalance,5000);
  assert.ok(single.months[0].interest>tiered.months[0].interest);
});
test('tiered interest is enabled by default for existing saved scenarios',()=>{
  const p=buildSchedule({initialBalance:20000});
  assert.equal(p.settings.tieredInterest,true);
  assert.ok(p.months[0].excessInterest>0);
  assert.equal(buildSchedule({initialBalance:20000,tieredInterest:'false'}).settings.tieredInterest,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFixedSchedule} from '../assets/fixed.mjs';

const cherry={initialBalance:60000,firstAER:4.2,taxRate:26,
  fixedTermMonths:48,fixedPayoutFrequency:'quarterly',
  stampDuty:false,monthlyFeeEnabled:false};

test('Cherry 48-month example matches official simple-interest simulator',()=>{
  const p=buildFixedSchedule(cherry);
  assert.equal(p.totalInterest,10080);
  assert.equal(p.totalTax,2620.8);
  assert.equal(p.totalNetInterest,7459.2);
  assert.equal(p.bankSimulatorTotal,67459.2);
  assert.equal(p.overallValue,67459.2);
  assert.equal(p.netNominalRate,3.108);
  assert.equal(p.couponCount,16);
  assert.equal(p.months.length,48);
});
test('quarterly coupons do not compound or change locked principal',()=>{
  const p=buildFixedSchedule(cherry);
  assert.ok(p.months.every(m=>m.openingBalance===60000&&m.closingBalance===60000));
  assert.equal(p.months[0].netInterest,0);
  assert.equal(p.months[1].netInterest,0);
  assert.equal(p.months[2].grossPaid,630);
  assert.equal(p.months[2].tax,163.8);
  assert.equal(p.months[2].netInterest,466.2);
  assert.equal(p.months[5].netInterest,466.2);
  assert.equal(p.months[47].netInterest,466.2);
});
test('annual 0.20 percent duty costs 480 over four years, and remains external',()=>{
  const p=buildFixedSchedule({...cherry,stampDuty:true,stampRate:0.2});
  assert.equal(p.totalStampDuty,480);
  assert.equal(p.netProfit,6979.2);
  assert.equal(p.overallValue,66979.2);
  assert.equal(p.annualisedNetSimpleRate,2.908);
  assert.equal(p.closingBalance,60000);
  assert.equal(p.months[11].stampDuty,120);
  assert.equal(p.months[23].stampDuty,120);
  assert.equal(p.months[35].stampDuty,120);
  assert.equal(p.months[47].stampDuty,120);
});
test('monthly subscription is external and reduces total profit',()=>{
  const p=buildFixedSchedule({...cherry,monthlyFeeEnabled:true,monthlyFee:9.99});
  assert.equal(p.totalMonthlyFees,479.52);
  assert.equal(p.netProfit,6979.68);
  assert.equal(p.closingBalance,60000);
});
test('single payout at maturity is supported without reinvestment',()=>{
  const p=buildFixedSchedule({...cherry,fixedPayoutFrequency:'maturity'});
  assert.equal(p.couponCount,1);
  assert.equal(p.months[46].netInterest,0);
  assert.equal(p.months[47].netInterest,7459.2);
  assert.equal(p.totalNetInterest,7459.2);
});
test('monthly payouts and short terms use simple, non-compounding interest',()=>{
  const p=buildFixedSchedule({...cherry,fixedPayoutFrequency:'monthly',fixedTermMonths:6});
  assert.equal(p.months.length,6);
  assert.equal(p.couponCount,6);
  assert.equal(p.totalInterest,1260);
  assert.equal(p.totalNetInterest,932.4);
  assert.equal(p.bankSimulatorTotal,60932.4);
});
test('partial-year stamp duty is prorated on remaining months',()=>{
  const p=buildFixedSchedule({...cherry,fixedTermMonths:18,stampDuty:true});
  assert.equal(p.totalStampDuty,180);
  assert.equal(p.months[11].stampDuty,120);
  assert.equal(p.months[17].stampDuty,60);
});
test('fixed-term mode ignores topups and tiered interest',()=>{
  const p=buildFixedSchedule({...cherry,monthlyDeposit:500,tieredInterest:true,
    threshold:15000,excessAER:1});
  assert.equal(p.totalDeposits,60000);
  assert.equal(p.months[47].closingBalance,60000);
  assert.equal(p.totalInterest,10080);
  assert.equal(p.settings.tieredInterest,false);
});
test('zero principal and zero tax return zero coupons safely',()=>{
  const p=buildFixedSchedule({...cherry,initialBalance:0});
  assert.equal(p.totalInterest,0);
  assert.equal(p.totalNetInterest,0);
  assert.equal(p.netNominalRate,3.108);
  assert.equal(p.annualisedNetSimpleRate,null);
});

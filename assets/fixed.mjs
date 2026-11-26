import {normalizeSettings,roundMoney} from './calc.mjs?v=14';

/**
 * Generic nominal-rate, non-compounding fixed-term bank deposit projection.
 * Capital stays locked; net coupons are paid outside the deposit.
 * Uses full-month simple interest (nominal rate / 12), not ACT/365.
 * Stamp duty and optional plan fees are charged outside the locked principal.
 * This intentionally models the arithmetic of bank comparison calculators,
 * not each provider's statement cut-offs or day-count convention.
 */
export function buildFixedSchedule(rawSettings={}){
  const settings=normalizeSettings({...rawSettings,accountType:'fixed'});
  settings.accountType='fixed';
  settings.tieredInterest=false;
  const monthsCount=settings.fixedTermMonths;
  const principal=settings.initialBalance;
  const rate=settings.firstAER/100;
  const grossMonthly=principal*rate/12;
  const payoutMonths=settings.fixedPayoutFrequency==='monthly'?1:
    settings.fixedPayoutFrequency==='annual'?12:
    settings.fixedPayoutFrequency==='maturity'?monthsCount:3;
  const months=[];
  let accruedForCoupon=0, grossInterestPaid=0, grossInterestAccrued=0;
  let totalTax=0,totalNetInterest=0,totalStampDuty=0,totalMonthlyFees=0;
  let lastStampMonth=0;
  for(let i=1;i<=monthsCount;i++){
    grossInterestAccrued+=grossMonthly;
    accruedForCoupon+=grossMonthly;
    let grossPaid=0,tax=0,netInterest=0;
    if(i%payoutMonths===0||i===monthsCount){
      grossPaid=roundMoney(accruedForCoupon);
      tax=roundMoney(grossPaid*settings.taxRate/100);
      netInterest=roundMoney(grossPaid-tax);
      accruedForCoupon=0;
      grossInterestPaid=roundMoney(grossInterestPaid+grossPaid);
      totalTax=roundMoney(totalTax+tax);
      totalNetInterest=roundMoney(totalNetInterest+netInterest);
    }
    let stampDuty=0;
    if(settings.stampDuty&&principal>0&&(i%12===0||i===monthsCount)){
      const coveredMonths=i-lastStampMonth;
      stampDuty=Math.max(1,roundMoney(principal*settings.stampRate/100*coveredMonths/12));
      totalStampDuty=roundMoney(totalStampDuty+stampDuty);
      lastStampMonth=i;
    }
    const monthlyFee=settings.monthlyFeeEnabled?settings.monthlyFee:0;
    totalMonthlyFees=roundMoney(totalMonthlyFees+monthlyFee);
    const netProfit=roundMoney(totalNetInterest-totalStampDuty-totalMonthlyFees);
    months.push({
      index:i,year:Math.ceil(i/12),monthOfYear:(i-1)%12+1,
      openingBalance:principal,firstTierBalance:principal,excessTierBalance:0,
      blendedRate:principal>0?settings.firstAER:null,
      closingBlendedRate:principal>0?settings.firstAER:null,
      firstInterest:roundMoney(grossMonthly),excessInterest:0,
      interest:roundMoney(grossMonthly),grossPaid,tax,netInterest,
      deposit:0,stampDuty,monthlyFee,
      netMonthlyBenefit:roundMoney(netInterest-stampDuty-monthlyFee),
      closingBalance:principal,
      grossClosingBalance:roundMoney(principal+grossInterestAccrued),
      overallValue:roundMoney(principal+netProfit),
      totalInterest:grossInterestPaid,totalTax,totalNetInterest,totalStampDuty,totalMonthlyFees,
      accumulatedNetProfit:netProfit
    });
  }
  const netProfit=roundMoney(totalNetInterest-totalStampDuty-totalMonthlyFees);
  const overallValue=roundMoney(principal+netProfit);
  const bankSimulatorTotal=roundMoney(principal+totalNetInterest);
  const annualisedNetSimpleRate=principal>0?
    (netProfit/principal)*(12/monthsCount)*100:null;
  return {
    settings,months,days:[],fixedTermMonths:monthsCount,
    closingBalance:principal,overallValue,
    bankSimulatorTotal,
    grossClosingBalance:roundMoney(principal+grossInterestPaid),
    startingBlendedRate:principal>0?settings.firstAER:null,
    endingBlendedRate:principal>0?settings.firstAER:null,
    totalFirstInterest:grossInterestPaid,totalExcessInterest:0,
    totalInterest:grossInterestPaid,
    totalTax,totalNetInterest,totalStampDuty,totalMonthlyFees,
    accountNetGrowth:0,
    netProfit,
    balanceAfterExternalFees:overallValue,
    totalDeposits:principal,
    firstExceedMonth:null,
    couponFrequencyMonths:payoutMonths,
    couponCount:months.filter(m=>m.grossPaid>0).length,
    netNominalRate:settings.firstAER*(1-settings.taxRate/100),
    annualisedNetSimpleRate
  };
}

import {normalizeSettings,buildSchedule,roundMoney} from './calc.mjs?v=14';
import {buildDailySchedule} from './daily.mjs?v=14';
import {buildFixedSchedule} from './fixed.mjs?v=14';

/**
 * Cross-product after-cost comparison at a common horizon in whole months.
 * Flexible settings are projected for the requested whole years and sliced
 * at the comparison month. Fixed-term results are valid only through the
 * contract maturity; no rollover or renewal is invented.
 * Optional coupon reinvestment is an illustrative external account with
 * a flat nominal gross annual p.a. rate, monthly crediting, and interest tax.
 */
export function compareSavingsScenario(raw,horizonMonths,reinvestGrossRate=0){
  const settings=normalizeSettings(raw);
  if(!Number.isInteger(horizonMonths)||horizonMonths<1||horizonMonths>360)
    throw Error('Choose a comparison horizon between 1 and 360 months.');
  if(!Number.isFinite(reinvestGrossRate)||reinvestGrossRate<0||reinvestGrossRate>100)
    throw Error('Coupon reinvestment rate must be between 0 and 100%.');
  if(settings.accountType==='fixed' && settings.fixedTermMonths<horizonMonths)
    return {compatible:false,reason:'Matures after '+settings.fixedTermMonths+' months; no automatic renewal is assumed.',settings};
  let projection,month;
  if(settings.accountType==='fixed'){
    projection=buildFixedSchedule(settings);
    month=projection.months[horizonMonths-1];
  }else{
    const years=Math.ceil(horizonMonths/12);
    projection=settings.creditFrequency==='daily'?
      buildDailySchedule({...settings,years}):buildSchedule({...settings,years});
    month=projection.months[horizonMonths-1];
  }
  let netInterest=month.totalNetInterest;
  let stampDuty=month.totalStampDuty;
  let planFees=month.totalMonthlyFees;
  let reinvestInterest=0,reinvestedCoupons=0;
  let netProfit=roundMoney(netInterest-stampDuty-planFees);
  let closingWealth;
  if(settings.accountType==='fixed'){
    // Matured coupons are held externally and optionally earn a flat rate;
    // the locked principal itself remains unchanged.
    let externalBalance=0;
    for(let i=0;i<horizonMonths;i++){
      const m=projection.months[i];
      if(reinvestGrossRate>0&&externalBalance>0){
        const gross=externalBalance*(reinvestGrossRate/100)/12;
        const net=roundMoney(gross*(1-settings.taxRate/100));
        reinvestInterest=roundMoney(reinvestInterest+net);
        externalBalance=roundMoney(externalBalance+net);
      }
      externalBalance=roundMoney(externalBalance+m.netInterest);
    }
    reinvestedCoupons=externalBalance;
    netProfit=roundMoney(netProfit+reinvestInterest);
    closingWealth=roundMoney(settings.initialBalance+netProfit);
  }else{
    closingWealth=roundMoney(month.closingBalance-month.totalMonthlyFees);
  }
  const totalContributions=roundMoney(settings.initialBalance+
    (settings.accountType==='fixed'?0:horizonMonths*settings.monthlyDeposit));
  return {
    compatible:true,settings,horizonMonths,
    maturityMonths:settings.accountType==='fixed'?settings.fixedTermMonths:null,
    principal:settings.initialBalance,totalContributions,
    netInterest,stampDuty,planFees,netProfit,closingWealth,
    reinvestInterest,reinvestedCoupons,
    annualisedSimpleNetReturn:settings.initialBalance>0?
      netProfit/settings.initialBalance*1200/horizonMonths:null,
    notes:settings.accountType==='fixed'
      ?'Fixed coupons paid externally; no interest on locked principal. Coupon reinvestment assumes a constant gross annual rate and monthly net credit.'
      :'Flexible savings compounds at the configured interest rate throughout; future promotional rate changes are not assumed.'
  };
}
export function comparePair(left,right,horizonMonths,reinvestGrossRate=0){
  const a=compareSavingsScenario(left,horizonMonths,reinvestGrossRate);
  const b=compareSavingsScenario(right,horizonMonths,reinvestGrossRate);
  return {a,b,comparable:a.compatible&&b.compatible,
    equalContributions:a.compatible&&b.compatible&&Math.abs(a.totalContributions-b.totalContributions)<.005,
    difference:a.compatible&&b.compatible?roundMoney(a.netProfit-b.netProfit):null};
}

import { normalizeSettings, roundMoney, effectiveMonthlyRate, blendedGrossRate } from './calc.mjs';

/**
 * Daily gross p.a. deposit interest, 365/366 actual-day basis.
 * Payments are accumulated until at least one cent can be credited.
 * Projection periods run from the chosen start date to the next monthly anniversary.
 * Payments and optional contributions are treated as end-of-day activity.
 */
export function safeStartDate(input){
  const text=String(input||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return '2026-11-22';
  const value=new Date(text+'T00:00:00.000Z');
  return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===text?text:'2026-11-22';
}
const ONE_DAY=86400000;
function addMonths(start,offset){
  const year=start.getUTCFullYear(),month=start.getUTCMonth()+offset;
  const day=start.getUTCDate();
  const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return new Date(Date.UTC(year,month,Math.min(day,last)));
}
function isLeap(y){return y%4===0&&(y%100!==0||y%400===0);}
function centsFloor(value){return Math.floor(Math.max(0,value)*100+1e-8)/100;}

export function buildDailySchedule(rawSettings={}){
  const settings=normalizeSettings(rawSettings);
  const startDate=safeStartDate(rawSettings.startDate||settings.startDate);
  settings.creditFrequency='daily';
  settings.startDate=startDate;
  const start=new Date(startDate+'T00:00:00.000Z');
  const periodCount=settings.years*12;
  const endBounds=Array.from({length:periodCount},(_,i)=>addMonths(start,i+1).getTime());
  const days=[],months=[];
  let balance=settings.initialBalance,grossBalance=balance;
  let unpaidNet=0,unpaidGross=0,firstExceedMonth=settings.tieredInterest&&balance>settings.threshold?0:null;
  let totalFirstRaw=0,totalExcessRaw=0,totalGrossRaw=0,totalTaxRaw=0;
  let totalNetInterest=0,totalStampDuty=0,totalMonthlyFees=0;
  let firstOfMonth=balance,firstOfMonthGross=grossBalance,periodIndex=0;
  let partial={first:0,excess:0,gross:0,tax:0,paid:0};
  const rateFirst=settings.firstAER/100,rateSecond=settings.excessAER/100;
  for(let ms=start.getTime(),final=endBounds[periodCount-1];ms<final;ms+=ONE_DAY){
    const date=new Date(ms);
    const dateString=date.toISOString().slice(0,10);
    const daysInYear=isLeap(date.getUTCFullYear())?366:365;
    const openingBalance=balance;
    const blendedRate=blendedGrossRate(openingBalance,settings);
    const firstBase=settings.tieredInterest?Math.min(openingBalance,settings.threshold):openingBalance;
    const excessBase=settings.tieredInterest?Math.max(0,openingBalance-settings.threshold):0;
    const firstGross=firstBase*rateFirst/daysInYear;
    const excessGross=excessBase*rateSecond/daysInYear;
    const gross=firstGross+excessGross;
    const tax=gross*settings.taxRate/100;
    unpaidNet+=gross-tax;
    const credited=centsFloor(unpaidNet);
    unpaidNet=Math.max(0,unpaidNet-credited);
    balance=roundMoney(balance+credited);
    totalFirstRaw+=firstGross;totalExcessRaw+=excessGross;
    totalGrossRaw+=gross;totalTaxRaw+=tax;
    totalNetInterest=roundMoney(totalNetInterest+credited);
    partial.first+=firstGross;partial.excess+=excessGross;
    partial.gross+=gross;partial.tax+=tax;partial.paid+=credited;
    // Gross comparison also credits only whole cents each day.
    const grossFirst=settings.tieredInterest?Math.min(grossBalance,settings.threshold):grossBalance;
    const grossExcess=settings.tieredInterest?Math.max(0,grossBalance-settings.threshold):0;
    unpaidGross+=grossFirst*rateFirst/daysInYear+grossExcess*rateSecond/daysInYear;
    const grossCredited=centsFloor(unpaidGross);
    unpaidGross=Math.max(0,unpaidGross-grossCredited);
    grossBalance=roundMoney(grossBalance+grossCredited);
    let deposit=0,stampDuty=0,monthlyFee=0;
    const periodEnd=ms+ONE_DAY>=endBounds[periodIndex];
    if(periodEnd){
      deposit=settings.monthlyDeposit;
      balance=roundMoney(balance+deposit);
      grossBalance=roundMoney(grossBalance+deposit);
      if(settings.stampDuty&&(periodIndex+1)%12===0&&balance>0){
        stampDuty=Math.min(balance,Math.max(1,roundMoney(balance*settings.stampRate/100)));
        balance=roundMoney(balance-stampDuty);
        totalStampDuty=roundMoney(totalStampDuty+stampDuty);
      }
      monthlyFee=settings.monthlyFeeEnabled?settings.monthlyFee:0;
      totalMonthlyFees=roundMoney(totalMonthlyFees+monthlyFee);
    }
    if(settings.tieredInterest&&firstExceedMonth===null&&balance>settings.threshold)firstExceedMonth=periodIndex+1;
    days.push({
      date:dateString,index:days.length+1,period:periodIndex+1,
      year:Math.floor(periodIndex/12)+1,monthOfYear:periodIndex%12+1,
      openingBalance,blendedRate,closingBlendedRate:blendedGrossRate(balance,settings),firstInterest:firstGross,excessInterest:excessGross,interest:gross,tax,
      netInterest:credited,deposit,stampDuty,monthlyFee,
      netDailyBenefit:roundMoney(credited-stampDuty-monthlyFee),
      closingBalance:balance,grossClosingBalance:grossBalance,
      totalNetInterest,totalStampDuty,totalMonthlyFees
    });
    if(periodEnd){
      const month=periodIndex+1;
      months.push({
        index:month,year:Math.ceil(month/12),monthOfYear:(month-1)%12+1,
        startDate:new Date(periodIndex===0?start.getTime():endBounds[periodIndex-1]).toISOString().slice(0,10),
        endDate:dateString,
        openingBalance:firstOfMonth,
        blendedRate:blendedGrossRate(firstOfMonth,settings),
        closingBlendedRate:blendedGrossRate(balance,settings),
        firstTierBalance:settings.tieredInterest?Math.min(firstOfMonth,settings.threshold):firstOfMonth,
        excessTierBalance:settings.tieredInterest?Math.max(0,firstOfMonth-settings.threshold):0,
        firstInterest:roundMoney(partial.first),excessInterest:roundMoney(partial.excess),
        interest:roundMoney(partial.gross),tax:roundMoney(partial.tax),
        netInterest:roundMoney(partial.paid),deposit,stampDuty,monthlyFee,
        netMonthlyBenefit:roundMoney(partial.paid-stampDuty-monthlyFee),
        closingBalance:balance,grossClosingBalance:grossBalance,
        totalInterest:roundMoney(totalGrossRaw),totalTax:roundMoney(totalTaxRaw),
        totalNetInterest,totalStampDuty,totalMonthlyFees
      });
      periodIndex++;
      firstOfMonth=balance;firstOfMonthGross=grossBalance;
      partial={first:0,excess:0,gross:0,tax:0,paid:0};
    }
  }
  const totalDeposits=roundMoney(settings.initialBalance+periodCount*settings.monthlyDeposit);
  return {
    settings,days,months,
    closingBalance:balance,grossClosingBalance:grossBalance,
    startingBlendedRate:blendedGrossRate(settings.initialBalance,settings),
    endingBlendedRate:blendedGrossRate(balance,settings),
    totalFirstInterest:roundMoney(totalFirstRaw),totalExcessInterest:roundMoney(totalExcessRaw),
    totalInterest:roundMoney(totalGrossRaw),totalTax:roundMoney(totalTaxRaw),
    totalNetInterest,totalStampDuty,totalMonthlyFees,
    accountNetGrowth:roundMoney(totalNetInterest-totalStampDuty),
    netProfit:roundMoney(totalNetInterest-totalStampDuty-totalMonthlyFees),
    balanceAfterExternalFees:roundMoney(balance-totalMonthlyFees),
    totalDeposits,firstExceedMonth,
    effectiveRates:{first:effectiveMonthlyRate(settings.firstAER),excess:effectiveMonthlyRate(settings.excessAER)}
  };
}

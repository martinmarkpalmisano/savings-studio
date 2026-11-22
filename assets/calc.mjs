/**
 * Italian savings projection: monthly tiered AER, withholding tax at credit,
 * and optional simplified annual deposit-account stamp duty.
 */
export function roundMoney(value){return Math.round((value+Number.EPSILON)*100)/100;}
export function effectiveMonthlyRate(aerPercent){return Math.pow(1+aerPercent/100,1/12)-1;}
function safeNumber(value,fallback,max){const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=max?n:fallback;}
export const DEFAULTS=Object.freeze({
  initialBalance:20000,monthlyDeposit:0,threshold:15000,
  firstAER:3.5,excessAER:1.25,years:5,currency:'EUR',
  taxRate:26,stampDuty:false,stampRate:0.2
});
export function normalizeSettings(input={}){
  return {
    initialBalance:roundMoney(safeNumber(input.initialBalance,DEFAULTS.initialBalance,1e12)),
    monthlyDeposit:roundMoney(safeNumber(input.monthlyDeposit,DEFAULTS.monthlyDeposit,1e10)),
    threshold:roundMoney(safeNumber(input.threshold,DEFAULTS.threshold,1e12)),
    firstAER:safeNumber(input.firstAER,DEFAULTS.firstAER,100),
    excessAER:safeNumber(input.excessAER,DEFAULTS.excessAER,100),
    years:Math.round(safeNumber(input.years,DEFAULTS.years,30))||1,
    currency:['EUR','GBP','USD'].includes(input.currency)?input.currency:'EUR',
    taxRate:safeNumber(input.taxRate,DEFAULTS.taxRate,100),
    stampDuty:input.stampDuty===true||input.stampDuty==='true',
    stampRate:safeNumber(input.stampRate,DEFAULTS.stampRate,100)
  };
}
export function buildSchedule(rawSettings={}){
  const settings=normalizeSettings({...DEFAULTS,...rawSettings});
  const r1=effectiveMonthlyRate(settings.firstAER);
  const r2=effectiveMonthlyRate(settings.excessAER);
  let balance=settings.initialBalance,grossBalance=balance;
  let totalFirstInterest=0,totalExcessInterest=0,totalTax=0,totalNetInterest=0,totalStampDuty=0;
  let firstExceedMonth=balance>settings.threshold?0:null;
  const months=[];
  for(let i=1;i<=settings.years*12;i++){
    const openingBalance=balance;
    const firstTierBalance=Math.min(openingBalance,settings.threshold);
    const excessTierBalance=Math.max(0,openingBalance-settings.threshold);
    const firstInterest=roundMoney(firstTierBalance*r1);
    const excessInterest=roundMoney(excessTierBalance*r2);
    const interest=roundMoney(firstInterest+excessInterest);
    const tax=roundMoney(interest*settings.taxRate/100);
    const netInterest=roundMoney(interest-tax);
    totalFirstInterest=roundMoney(totalFirstInterest+firstInterest);
    totalExcessInterest=roundMoney(totalExcessInterest+excessInterest);
    totalTax=roundMoney(totalTax+tax);
    totalNetInterest=roundMoney(totalNetInterest+netInterest);
    balance=roundMoney(openingBalance+netInterest+settings.monthlyDeposit);
    let stampDuty=0;
    if(settings.stampDuty&&i%12===0&&balance>0){
      stampDuty=Math.min(balance,Math.max(1,roundMoney(balance*settings.stampRate/100)));
      balance=roundMoney(balance-stampDuty);
      totalStampDuty=roundMoney(totalStampDuty+stampDuty);
    }
    const grossFirst=Math.min(grossBalance,settings.threshold);
    const grossExcess=Math.max(0,grossBalance-settings.threshold);
    grossBalance=roundMoney(grossBalance+roundMoney(grossFirst*r1)+roundMoney(grossExcess*r2)+settings.monthlyDeposit);
    if(firstExceedMonth===null&&balance>settings.threshold)firstExceedMonth=i;
    months.push({
      index:i,year:Math.ceil(i/12),monthOfYear:((i-1)%12)+1,
      openingBalance,firstTierBalance,excessTierBalance,
      firstInterest,excessInterest,interest,tax,netInterest,stampDuty,
      deposit:settings.monthlyDeposit,closingBalance:balance,grossClosingBalance:grossBalance,
      totalInterest:roundMoney(totalFirstInterest+totalExcessInterest),
      totalTax,totalNetInterest,totalStampDuty
    });
  }
  const totalDeposits=roundMoney(settings.initialBalance+settings.years*12*settings.monthlyDeposit);
  return {
    settings,months,closingBalance:balance,grossClosingBalance:grossBalance,
    totalFirstInterest,totalExcessInterest,
    totalInterest:roundMoney(totalFirstInterest+totalExcessInterest),
    totalTax,totalNetInterest,totalStampDuty,
    netProfit:roundMoney(totalNetInterest-totalStampDuty),
    totalDeposits,firstExceedMonth,effectiveRates:{first:r1,excess:r2}
  };
}

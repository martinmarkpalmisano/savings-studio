/**
 * Italian savings projection: monthly tiered AER, withholding tax at credit,
 * and optional simplified annual deposit-account stamp duty.
 */
export function roundMoney(value){return Math.round((value+Number.EPSILON)*100)/100;}
export function effectiveMonthlyRate(aerPercent){return Math.pow(1+aerPercent/100,1/12)-1;}
/**
 * Balance-weighted gross advertised annual rate across interest tiers.
 * In daily mode this is a weighted gross p.a. rate; in monthly mode
 * it is a weighted quoted AER, not a separately annualised effective rate.
 * Null means no positive balance from which to define a weighted rate.
 */
export function blendedGrossRate(balance,settings){
  if(!Number.isFinite(balance)||balance<=0)return null;
  const first=settings.tieredInterest?Math.min(balance,settings.threshold):balance;
  const excess=settings.tieredInterest?Math.max(0,balance-settings.threshold):0;
  if(excess===0)return settings.firstAER;
  if(first===0)return settings.excessAER;
  return (first*settings.firstAER+excess*settings.excessAER)/balance;
}
/** Accept Italian decimal commas, English decimal points and grouped money amounts. */
export function parseLocalizedNumber(value, kind='decimal'){
  if(typeof value==='number')return value;
  const raw=String(value??'').trim().replace(/[\s\u00A0\u202F]/g,'');
  if(!raw || !/^[0-9.,]+$/.test(raw))return NaN;
  const comma=raw.lastIndexOf(','),dot=raw.lastIndexOf('.');
  let canonical=raw;
  if(comma!==-1&&dot!==-1){
    canonical=comma>dot ? raw.replaceAll('.','').replace(',','.') : raw.replaceAll(',','');
  }else if(comma!==-1){
    canonical=raw.replace(',','.');
  }else if(kind==='money'&&/^\d{1,3}(\.\d{3})+$/.test(raw)){
    canonical=raw.replaceAll('.','');
  }
  return Number(canonical);
}
function safeNumber(value,fallback,max){const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=max?n:fallback;}
export const DEFAULTS=Object.freeze({
  initialBalance:20000,monthlyDeposit:0,threshold:15000,tieredInterest:true,
  firstAER:3.5,excessAER:1.25,years:5,currency:'EUR',
  taxRate:26,stampDuty:false,stampRate:0.2,
  monthlyFeeEnabled:false,monthlyFee:9.99,
  creditFrequency:'daily',startDate:'2026-11-22'
});
export function normalizeSettings(input={}){
  return {
    initialBalance:roundMoney(safeNumber(input.initialBalance,DEFAULTS.initialBalance,1e12)),
    monthlyDeposit:roundMoney(safeNumber(input.monthlyDeposit,DEFAULTS.monthlyDeposit,1e10)),
    threshold:roundMoney(safeNumber(input.threshold,DEFAULTS.threshold,1e12)),
    tieredInterest:![false,'false',0,'0'].includes(input.tieredInterest),
    firstAER:safeNumber(input.firstAER,DEFAULTS.firstAER,100),
    excessAER:safeNumber(input.excessAER,DEFAULTS.excessAER,100),
    years:Math.round(safeNumber(input.years,DEFAULTS.years,30))||1,
    currency:['EUR','GBP','USD'].includes(input.currency)?input.currency:'EUR',
    taxRate:safeNumber(input.taxRate,DEFAULTS.taxRate,100),
    stampDuty:input.stampDuty===true||input.stampDuty==='true',
    stampRate:safeNumber(input.stampRate,DEFAULTS.stampRate,100),
    monthlyFeeEnabled:input.monthlyFeeEnabled===true||input.monthlyFeeEnabled==='true',
    monthlyFee:roundMoney(safeNumber(input.monthlyFee,DEFAULTS.monthlyFee,1e8)),
    creditFrequency:input.creditFrequency==='monthly'?'monthly':'daily',
    startDate:typeof input.startDate==='string'?input.startDate:DEFAULTS.startDate
  };
}
export function buildSchedule(rawSettings={}){
  const settings=normalizeSettings({...DEFAULTS,...rawSettings});
  const r1=effectiveMonthlyRate(settings.firstAER);
  const r2=effectiveMonthlyRate(settings.excessAER);
  let balance=settings.initialBalance,grossBalance=balance;
  let totalFirstInterest=0,totalExcessInterest=0,totalTax=0,totalNetInterest=0,totalStampDuty=0,totalMonthlyFees=0;
  let firstExceedMonth=settings.tieredInterest&&balance>settings.threshold?0:null;
  const months=[];
  for(let i=1;i<=settings.years*12;i++){
    const openingBalance=balance;
    const blendedRate=blendedGrossRate(openingBalance,settings);
    const firstTierBalance=settings.tieredInterest?Math.min(openingBalance,settings.threshold):openingBalance;
    const excessTierBalance=settings.tieredInterest?Math.max(0,openingBalance-settings.threshold):0;
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
    const grossFirst=settings.tieredInterest?Math.min(grossBalance,settings.threshold):grossBalance;
    const grossExcess=settings.tieredInterest?Math.max(0,grossBalance-settings.threshold):0;
    grossBalance=roundMoney(grossBalance+roundMoney(grossFirst*r1)+roundMoney(grossExcess*r2)+settings.monthlyDeposit);
    if(settings.tieredInterest&&firstExceedMonth===null&&balance>settings.threshold)firstExceedMonth=i;
    // Account-plan fees are paid separately (e.g. a Revolut subscription),
    // so they reduce economic profit but do not alter savings interest compounding.
    const monthlyFee=settings.monthlyFeeEnabled?settings.monthlyFee:0;
    totalMonthlyFees=roundMoney(totalMonthlyFees+monthlyFee);
    const netMonthlyBenefit=roundMoney(netInterest-stampDuty-monthlyFee);
    months.push({
      index:i,year:Math.ceil(i/12),monthOfYear:((i-1)%12)+1,
      openingBalance,firstTierBalance,excessTierBalance,blendedRate,closingBlendedRate:blendedGrossRate(balance,settings),
      firstInterest,excessInterest,interest,tax,netInterest,stampDuty,monthlyFee,netMonthlyBenefit,
      deposit:settings.monthlyDeposit,closingBalance:balance,grossClosingBalance:grossBalance,
      totalInterest:roundMoney(totalFirstInterest+totalExcessInterest),
      totalTax,totalNetInterest,totalStampDuty,totalMonthlyFees
    });
  }
  const totalDeposits=roundMoney(settings.initialBalance+settings.years*12*settings.monthlyDeposit);
  return {
    settings,months,closingBalance:balance,grossClosingBalance:grossBalance,
    startingBlendedRate:blendedGrossRate(settings.initialBalance,settings),
    endingBlendedRate:blendedGrossRate(balance,settings),
    totalFirstInterest,totalExcessInterest,
    totalInterest:roundMoney(totalFirstInterest+totalExcessInterest),
    totalTax,totalNetInterest,totalStampDuty,totalMonthlyFees,
    accountNetGrowth:roundMoney(totalNetInterest-totalStampDuty),
    netProfit:roundMoney(totalNetInterest-totalStampDuty-totalMonthlyFees),
    balanceAfterExternalFees:roundMoney(balance-totalMonthlyFees),
    totalDeposits,firstExceedMonth,effectiveRates:{first:r1,excess:r2}
  };
}

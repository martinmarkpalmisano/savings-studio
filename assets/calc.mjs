/**
 * Tiered savings projection. Each AER is converted to the effective monthly rate.
 * Interest for each tier is rounded to the smallest currency unit each month,
 * credited to the account, then the optional month-end contribution is added.
 * Forecasts are illustrative: banks may calculate daily, use different rounding,
 * and change their interest rates.
 */
export function roundMoney(number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
}
export function effectiveMonthlyRate(aerPercent) {
  return Math.pow(1 + aerPercent / 100, 1 / 12) - 1;
}
function safeNumber(value, fallback, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : fallback;
}
export const DEFAULTS = Object.freeze({
  initialBalance: 20000,
  monthlyDeposit: 0,
  threshold: 15000,
  firstAER: 3.5,
  excessAER: 1.25,
  years: 5,
  currency: 'GBP',
});
export function normalizeSettings(input = {}) {
  return {
    initialBalance: roundMoney(safeNumber(input.initialBalance, DEFAULTS.initialBalance, 1e12)),
    monthlyDeposit: roundMoney(safeNumber(input.monthlyDeposit, DEFAULTS.monthlyDeposit, 1e10)),
    threshold: roundMoney(safeNumber(input.threshold, DEFAULTS.threshold, 1e12)),
    firstAER: safeNumber(input.firstAER, DEFAULTS.firstAER, 100),
    excessAER: safeNumber(input.excessAER, DEFAULTS.excessAER, 100),
    years: Math.round(safeNumber(input.years, DEFAULTS.years, 30)) || 1,
    currency: ['GBP', 'EUR', 'USD'].includes(input.currency) ? input.currency : 'GBP',
  };
}
export function buildSchedule(rawSettings = {}) {
  const settings = normalizeSettings({...DEFAULTS, ...rawSettings});
  const r1 = effectiveMonthlyRate(settings.firstAER);
  const r2 = effectiveMonthlyRate(settings.excessAER);
  let balance = settings.initialBalance;
  let totalFirstInterest = 0;
  let totalExcessInterest = 0;
  let firstExceedMonth = balance > settings.threshold ? 0 : null;
  const months = [];
  for (let i = 1; i <= settings.years * 12; i++) {
    const openingBalance = balance;
    const firstTierBalance = Math.min(openingBalance, settings.threshold);
    const excessTierBalance = Math.max(0, openingBalance - settings.threshold);
    const firstInterest = roundMoney(firstTierBalance * r1);
    const excessInterest = roundMoney(excessTierBalance * r2);
    const interest = roundMoney(firstInterest + excessInterest);
    totalFirstInterest = roundMoney(totalFirstInterest + firstInterest);
    totalExcessInterest = roundMoney(totalExcessInterest + excessInterest);
    balance = roundMoney(openingBalance + interest + settings.monthlyDeposit);
    if (firstExceedMonth === null && balance > settings.threshold) firstExceedMonth = i;
    months.push({
      index: i, year: Math.ceil(i / 12), monthOfYear: ((i - 1) % 12) + 1,
      openingBalance, firstTierBalance, excessTierBalance,
      firstInterest, excessInterest, interest, deposit: settings.monthlyDeposit,
      closingBalance: balance, totalInterest: roundMoney(totalFirstInterest + totalExcessInterest),
    });
  }
  return {
    settings, months, closingBalance: balance,
    totalFirstInterest, totalExcessInterest,
    totalInterest: roundMoney(totalFirstInterest + totalExcessInterest),
    totalDeposits: roundMoney(settings.initialBalance + settings.years * 12 * settings.monthlyDeposit),
    firstExceedMonth, effectiveRates: {first: r1, excess: r2},
  };
}

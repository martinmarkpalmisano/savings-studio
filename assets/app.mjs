import { buildSchedule, DEFAULTS, parseLocalizedNumber } from './calc.mjs';
import { buildDailySchedule, safeStartDate } from './daily.mjs';
const $ = id => document.getElementById(id);
const fields = ['initialBalance','monthlyDeposit','threshold','firstAER','excessAER','years','currency','taxRate','stampRate','monthlyFee'];
const moneyFields = new Set(['initialBalance','monthlyDeposit','threshold','monthlyFee']);
const parseInput = (field,value) => parseLocalizedNumber(value,moneyFields.has(field)?'money':'decimal');
const displayInput = (field,value) => ['currency','years'].includes(field) ? String(value) : String(value).replace('.', ',');
const aliases = {initialBalance:'start',monthlyDeposit:'deposit',threshold:'limit',firstAER:'rate1',excessAER:'rate2',tieredInterest:'tiered',years:'years',currency:'currency',taxRate:'tax',stampDuty:'stamp',stampRate:'stampRate',monthlyFeeEnabled:'monthlyFeeEnabled',monthlyFee:'monthlyFee',creditFrequency:'frequency',startDate:'date'};
const settingKey = 'savings-studio-settings-v1';
const themeKey = 'savings-studio-theme-v1';
let settings = {...DEFAULTS}, projection, selectedYear = '1', selectedDailyPeriod = '1', chartMetric = 'interest', toastTimer;
function money(number, decimals = 2) {
  return new Intl.NumberFormat(settings.currency === 'EUR' ? 'it-IT':'en-GB', {
    style:'currency',currency:settings.currency,
    minimumFractionDigits:decimals,maximumFractionDigits:decimals
  }).format(number);
}
function compact(n) {
  const symbol = {GBP:'£',EUR:'€',USD:'$'}[settings.currency];
  return symbol + (n >= 1000000 ? (n/1000000).toFixed(1)+'m' : n >= 1000 ? (n/1000).toFixed(0)+'k' : n.toFixed(n < 10 ? 2 : 0));
}
function percent(n){return Number(n).toLocaleString('en-GB',{maximumFractionDigits:2})+'%';}
function signedMoney(n){return (n>=0?'+':'−')+money(Math.abs(n));}
function detailedMoney(n){return new Intl.NumberFormat(settings.currency==='EUR'?'it-IT':'en-GB',{
  minimumFractionDigits:4,maximumFractionDigits:4
}).format(n); }
function localDateISO(){
  const d=new Date();
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function toast(t){
  $('toast').textContent=t;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);
}
function load(){
  try {
    const s = JSON.parse(localStorage.getItem(settingKey)||'{}');
    if(!s.startDate)settings.startDate=localDateISO();
    if(s && typeof s === 'object') {
      settings = {...settings,...s};
      if(!Object.prototype.hasOwnProperty.call(s,'taxRate') && s.currency==='GBP') settings.currency='EUR';
    }
  } catch(e){}
  const params = new URLSearchParams(location.search);
  for(const [field,key] of Object.entries(aliases)){
    if(params.has(key)) settings[field] = ['currency','creditFrequency','startDate'].includes(field) ? params.get(key) : ['stampDuty','tieredInterest','monthlyFeeEnabled'].includes(field) ? ['true','1'].includes(params.get(key)) : parseInput(field,params.get(key));
  }
}
function inputs(){
  fields.forEach(k=>$(k).value=displayInput(k,settings[k]));
  $('stampDuty').checked=settings.stampDuty;
  $('tieredInterest').checked=settings.tieredInterest;
  $('stampRateContainer').hidden=!settings.stampDuty;
  $('monthlyFeeEnabled').checked=settings.monthlyFeeEnabled;
  $('monthlyFeeContainer').hidden=!settings.monthlyFeeEnabled;
  $('creditFrequency').value=settings.creditFrequency;
  $('startDate').value=safeStartDate(settings.startDate);
}
function render(){
  projection = settings.creditFrequency==='daily' ? buildDailySchedule(settings) : buildSchedule(settings);
  settings = projection.settings;
  const daily=settings.creditFrequency==='daily';
  $('creditFrequency').value=settings.creditFrequency;
  $('startDateControl').hidden=!daily;
  $('startDate').value=safeStartDate(settings.startDate);
  $('dailyStatementSection').hidden=!daily;
  $('rateTypeLabel').textContent=daily?'GROSS P.A.':'AER / YEAR';
  $('firstRateLabel').textContent=daily?'Annual interest rate (gross p.a.)':'Annual Equivalent Rate (AER)';
  $('excessRateLabel').textContent=daily?'Annual interest rate (gross p.a.)':'Annual Equivalent Rate (AER)';
  $('frequencyDescription').textContent=daily
    ? 'Daily accrual at gross p.a. / 365 or 366, minus tax. Fractional cents carry over until €0.01 can be credited.'
    : 'Monthly effective interest, using the quoted AER.';
  $('yearsValue').textContent=settings.years;
  $('monthlyFeeEnabled').checked=settings.monthlyFeeEnabled;
  $('monthlyFeeContainer').hidden=!settings.monthlyFeeEnabled;
  const isTiered = settings.tieredInterest;
  $('tieredInterest').checked=isTiered;
  $('thresholdControl').hidden=!isTiered;
  $('excessTierCard').hidden=!isTiered;
  $('interestRateHeading').textContent=isTiered?'INTEREST TIERS':'INTEREST RATE';
  $('firstTierTitle').textContent=isTiered?'Tier 1':'Single rate';
  $('firstTierBadge').textContent=isTiered?'UP TO LIMIT':'FULL BALANCE';
  $('tierModeDescription').textContent=isTiered?'Different rates above and below a balance threshold.':'One AER applies to your entire balance.';
  $('statementRateColumn').textContent=isTiered?'FIRST TIER':'RATE INTEREST';
  document.body.dataset.rateMode=isTiered?'tiered':'single';
  document.querySelectorAll('[data-symbol]').forEach(x=>x.textContent=({GBP:'£',EUR:'€',USD:'$'})[settings.currency]);
  const months=projection.months, last=months[months.length-1];
  $('endingBalance').textContent=money(projection.closingBalance);
  $('totalInterest').textContent=signedMoney(projection.netProfit);
  $('durationLabel').textContent=settings.years + (settings.years===1?' year':' years');
  $('totalContributions').textContent=money(projection.totalDeposits);
  $('heroInterest').textContent=signedMoney(projection.accountNetGrowth);
  $('heroFinal').textContent=money(projection.closingBalance);
  $('firstMonthInterest').textContent='+'+money(months[0].netInterest);
  $('lastMonthLabel').textContent='MONTH '+last.index;
  $('lastMonthInterest').textContent='+'+money(last.netInterest);
  $('firstTierTotal').textContent=money(projection.totalFirstInterest);
  $('secondTierTotal').textContent=money(projection.totalExcessInterest);
  $('taxGrossInterest').textContent=money(projection.totalInterest);
  $('taxWithheld').textContent='−'+money(projection.totalTax);
  $('taxStamp').textContent='−'+money(projection.totalStampDuty);
  $('planFeesTotal').textContent='−'+money(projection.totalMonthlyFees);
  $('effectiveFinalValue').textContent=money(projection.balanceAfterExternalFees);
  $('monthlyFeeNote').textContent=settings.monthlyFeeEnabled
    ? 'The '+money(settings.monthlyFee)+' plan fee is paid outside savings each month: it reduces total economic profit but not the bank balance or interest compounding.'
    : 'Plan fees are excluded. Enable them if your savings rate requires a paid subscription.';
  $('taxNetInterest').textContent='+'+money(projection.totalNetInterest);
  $('taxNetProfit').textContent=signedMoney(projection.netProfit);
  $('grossFinal').textContent=money(projection.grossClosingBalance);
  $('stampRateContainer').hidden=!settings.stampDuty;
  $('taxSummaryNote').textContent=settings.stampDuty?'With estimated annual deposit-account stamp duty.':'Deposit-account stamp duty excluded. Enable it in account settings if applicable.';
  $('firstTierCaption').textContent=percent(settings.firstAER)+' on first '+money(settings.threshold,0);
  $('secondTierCaption').textContent=percent(settings.excessAER)+' above '+money(settings.threshold,0);
  const share=projection.totalInterest>0 ? 100*projection.totalFirstInterest/projection.totalInterest : 100;
  $('tierTrackFirst').style.width=share+'%';
  $('tierTrackSecond').style.width=(100-share)+'%';
  const crossed=projection.firstExceedMonth;
  $('crossNote').textContent=crossed===0?'Starting balance is already above the limit. Only the excess earns the second-tier rate.'
    :crossed===null?'The balance stays within the first tier throughout the projection.'
    :'The balance first exceeds the limit at the end of month '+crossed+'. The excess earns its rate from month '+(crossed+1)+'.';
  if(selectedYear!=='all' && Number(selectedYear)>settings.years) selectedYear=String(settings.years);
  let options='<option value="all">All months</option>';
  for(let i=1;i<=settings.years;i++)options+='<option value="'+i+'">Year '+i+'</option>';
  $('yearFilter').innerHTML=options;
  $('yearFilter').value=selectedYear;
  table();
  dailyTable();
  chart();
  try{localStorage.setItem(settingKey,JSON.stringify(settings));}catch(e){}
}
function table(){
  const rows=selectedYear==='all'?projection.months:projection.months.filter(m=>m.year===Number(selectedYear));
  $('statementRows').innerHTML=rows.map(m=>'<tr><td>'+String(m.index).padStart(2,'0')+'</td><td>'+money(m.openingBalance)+'</td><td>'+money(m.firstInterest)+'</td><td>'+money(m.excessInterest)+'</td><td>'+money(m.interest)+'</td><td class="tax-amount">−'+money(m.tax)+'</td><td class="interest">+'+money(m.netInterest)+'</td><td>'+money(m.deposit)+'</td><td class="tax-amount">'+(m.stampDuty?'−'+money(m.stampDuty):'—')+'</td><td class="tax-amount">'+(m.monthlyFee?'−'+money(m.monthlyFee):'—')+'</td><td class="interest">'+signedMoney(m.netMonthlyBenefit)+'</td><td>'+money(m.closingBalance)+'</td></tr>').join('');
  $('tableCount').textContent='Showing '+rows.length+' of '+projection.months.length+' months';
}
function dailyTable(){
  const section=$('dailyStatementSection');
  if(settings.creditFrequency!=='daily'){
    section.hidden=true;
    return;
  }
  section.hidden=false;
  const options=projection.months.map(m=>'<option value="'+m.index+'">Period '+m.index+' · '+m.startDate+' – '+m.endDate+'</option>').join('');
  $('dailyPeriodFilter').innerHTML=options;
  if(Number(selectedDailyPeriod)>projection.months.length)selectedDailyPeriod='1';
  $('dailyPeriodFilter').value=selectedDailyPeriod;
  drawDailyPeriod();
}
function drawDailyPeriod(){
  if(settings.creditFrequency!=='daily')return;
  const rows=projection.days.filter(d=>d.period===Number(selectedDailyPeriod));
  $('dailyStatementRows').innerHTML=rows.map(m=>
    '<tr><td>'+m.date+'</td><td>'+money(m.openingBalance)+'</td>'
    +'<td>'+detailedMoney(m.interest)+'</td><td class="tax-amount">−'+detailedMoney(m.tax)+'</td>'
    +'<td class="interest">+'+money(m.netInterest)+'</td><td>'+money(m.deposit)+'</td>'
    +'<td class="tax-amount">'+(m.stampDuty?'−'+money(m.stampDuty):'—')+'</td>'
    +'<td class="tax-amount">'+(m.monthlyFee?'−'+money(m.monthlyFee):'—')+'</td>'
    +'<td>'+money(m.closingBalance)+'</td></tr>'
  ).join('');
  $('dailyTableCount').textContent=rows.length+' days shown · '+projection.days.length+' days projected';
}
function chart(){
  const svg=$('growthChart'), months=projection.months;
  const primary=months.map(m=>chartMetric==='interest'?m.netMonthlyBenefit:m.closingBalance);
  const secondary=months.map(m=>chartMetric==='interest'?m.interest:m.grossClosingBalance);
  const W=760,H=264,L=65,R=10,T=12,B=20,pw=W-L-R,ph=H-T-B;
  const minValue=Math.min(0,...primary,...secondary);
  const maxValue=Math.max(0.01,...primary,...secondary);
  const pad=Math.max(1,(maxValue-minValue)*0.1);
  const low=minValue-pad,high=maxValue+pad;
  const mapY=v=>T+ph*(high-v)/(high-low);
  const coords=primary.map((v,i)=>({x:L+i/(primary.length-1)*pw,y:mapY(v)}));
  const ghost=secondary.map((v,i)=>({x:L+i/(secondary.length-1)*pw,y:mapY(v)}));
  const path=c=>c.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
  let grid='';
  for(let i=0;i<=4;i++){
    const y=T+ph*i/4;
    grid+='<line class="gridline" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/>';
    const tick=high-(high-low)*i/4;
    grid+='<text class="axislabel" x="'+(L-10)+'" y="'+(y+4)+'" text-anchor="end">'+(tick<0?'−'+compact(-tick):compact(tick))+'</text>';
  }
  const last=coords[coords.length-1];
  const baselineY=mapY(0);
  svg.innerHTML=grid+'<line class="gridline" x1="'+L+'" x2="'+(W-R)+'" y1="'+baselineY+'" y2="'+baselineY+'"/><path class="chart-area" d="'+path(coords)+' L'+last.x+','+baselineY+' L'+L+','+baselineY+' Z"/><path class="chart-line-secondary" d="'+path(ghost)+'"/><path class="chart-line" d="'+path(coords)+'"/><line id="focusGuide" class="focus-guide" x1="0" x2="0" y1="'+T+'" y2="'+(T+ph)+'" style="display:none"/><circle id="focusDot" class="focus-dot" cx="0" cy="0" r="5" style="display:none"/><rect id="chartHit" x="'+L+'" y="'+T+'" width="'+pw+'" height="'+ph+'" fill="transparent"/>';
  $('chartLegend').textContent=chartMetric==='interest'?'Net monthly benefit':'After-tax account balance';
  $('chartSecondaryLegend').textContent=chartMetric==='interest'?'Gross monthly interest':'Balance without taxes';
  $('chartEndLabel').textContent='Month '+months.length;
  svg.setAttribute('aria-label',chartMetric==='interest'?'Net monthly benefit after tax and fees compared with gross interest':'After-tax balance compared with hypothetical balance before tax');
  for(const metric of ['interest','balance']){
    const b=$(metric+'ChartBtn');
    b.classList.toggle('active',chartMetric===metric);
    b.setAttribute('aria-pressed',String(chartMetric===metric));
  }
  const tooltip=$('chartTooltip');
  tooltip.hidden=true;
  function pointer(ev){
    const rect=svg.getBoundingClientRect();if(!rect.width)return;
    const x=(ev.clientX-rect.left)*W/rect.width;
    const i=Math.max(0,Math.min(months.length-1,Math.round((x-L)/pw*(months.length-1))));
    const c=coords[i],guide=$('focusGuide'),dot=$('focusDot');
    guide.setAttribute('x1',c.x);guide.setAttribute('x2',c.x);
    dot.setAttribute('cx',c.x);dot.setAttribute('cy',c.y);
    guide.style.display='';dot.style.display='';
    tooltip.textContent='Month '+months[i].index+' · Net '+money(primary[i])+' · Gross '+money(secondary[i]);
    tooltip.hidden=false;
    const width=$('chartWrap').clientWidth;
    tooltip.style.left=Math.max(4,Math.min(width-tooltip.offsetWidth-4,c.x/W*width-tooltip.offsetWidth/2))+'px';
    tooltip.style.top='4px';
  }
  $('chartHit').addEventListener('pointermove',pointer);
  $('chartHit').addEventListener('pointerdown',pointer);
  svg.onpointerleave=()=>{tooltip.hidden=true;$('focusGuide').style.display='none';$('focusDot').style.display='none';};
}
function exportDailyCSV(){
  if(settings.creditFrequency!=='daily'){toast('Select Daily interest first.');return;}
  const header=['Date','Payment period','Opening balance','First tier gross accrued','Excess tier gross accrued','Total gross accrued','Tax accrued (estimated)','Net credited','Additional contribution','Stamp duty','External plan fee','Net daily economic benefit','Closing savings balance','Cumulative net interest','Cumulative stamp duty','Cumulative plan fees'];
  const columns=m=>[m.date,m.period,m.openingBalance,m.firstInterest,m.excessInterest,m.interest,m.tax,m.netInterest,m.deposit,m.stampDuty,m.monthlyFee,m.netDailyBenefit,m.closingBalance,m.totalNetInterest,m.totalStampDuty,m.totalMonthlyFees];
  const values=projection.days.map(d=>columns(d).map((v,i)=>i===0?String(v):i===1?String(v):Number(v).toFixed(i===3||i===4||i===5||i===6?6:2)).join(','));
  const blob=new Blob(['\uFEFF'+[header.join(','),...values].join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='savings-studio-daily-projection.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('Full daily statement exported.');
}
function exportCSV(){
  const header=['Month','Year','Opening balance','First-tier gross interest','Excess-tier gross interest','Gross interest','Tax withheld','Net interest credited','Additional contribution','Stamp duty','Plan fee (paid externally)','Net monthly benefit','Closing account balance','Cumulative tax','Cumulative stamp duty','Cumulative plan fees','Cumulative net interest'];
  const data=projection.months.map(m=>[m.index,m.year,m.openingBalance,m.firstInterest,m.excessInterest,m.interest,m.tax,m.netInterest,m.deposit,m.stampDuty,m.monthlyFee,m.netMonthlyBenefit,m.closingBalance,m.totalTax,m.totalStampDuty,m.totalMonthlyFees,m.totalNetInterest].map((n,i)=>i<2?String(n):Number(n).toFixed(2)).join(','));
  const file=new Blob(['\uFEFF'+[header.join(','),...data].join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download='savings-studio-after-tax-monthly.csv';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('After-tax monthly statement exported.');
}
async function share(){
  const url=new URL(location.href);url.search='';url.hash='';
  for(const [field,key] of Object.entries(aliases))url.searchParams.set(key,settings[field]);
  if(navigator.share && /^https?:$/.test(url.protocol)){
    try{await navigator.share({title:'Savings Studio projection',url:url.href});return;}
    catch(e){if(e.name==='AbortError')return;}
  }
  try{await navigator.clipboard.writeText(url.href);toast('Scenario link copied.');}
  catch(e){window.prompt('Copy this scenario link:',url.href);}
}
function init(){
  load();
  settings=buildSchedule(settings).settings;
  inputs();
  try{
    const theme=localStorage.getItem(themeKey);
    if(theme==='dark'||theme==='light')document.documentElement.dataset.theme=theme;
  }catch(e){}
  $('themeToggle').textContent=document.documentElement.dataset.theme==='light'?'☾':'☀';
  for(const field of fields){
    const element=$(field);
    element.addEventListener(field==='years'?'input':'change',()=>{
      const entered=field==='currency'?element.value:parseInput(field,element.value);
      if(field!=='currency' && !Number.isFinite(entered)){
        toast('Please enter a valid amount or rate (e.g. 3,5).');
        element.value=displayInput(field,settings[field]);
        return;
      }
      settings[field]=entered;
      settings=buildSchedule(settings).settings;
      element.value=displayInput(field,settings[field]);
      render();
    });
  }
  $('stampDuty').addEventListener('change',e=>{settings.stampDuty=e.target.checked;render();});
  $('monthlyFeeEnabled').addEventListener('change',e=>{settings.monthlyFeeEnabled=e.target.checked;render();});
  $('tieredInterest').addEventListener('change',e=>{settings.tieredInterest=e.target.checked;render();});
  $('yearFilter').addEventListener('change',e=>{selectedYear=e.target.value;table();});
  $('creditFrequency').addEventListener('change',e=>{settings.creditFrequency=e.target.value;render();});
  $('startDate').addEventListener('change',e=>{settings.startDate=safeStartDate(e.target.value);selectedDailyPeriod='1';render();});
  $('dailyPeriodFilter').addEventListener('change',e=>{selectedDailyPeriod=e.target.value;drawDailyPeriod();});
  $('exportDailyBtn').addEventListener('click',exportDailyCSV);
  $('interestChartBtn').addEventListener('click',()=>{chartMetric='interest';chart();});
  $('balanceChartBtn').addEventListener('click',()=>{chartMetric='balance';chart();});
  $('exportBtn').addEventListener('click',exportCSV);
  $('copyLinkBtn').addEventListener('click',share);
  $('resetBtn').addEventListener('click',()=>{
    settings={...DEFAULTS,startDate:localDateISO()};selectedYear='1';selectedDailyPeriod='1';inputs();render();toast('Calculator reset.');
  });
  $('themeToggle').addEventListener('click',()=>{
    const theme=document.documentElement.dataset.theme==='light'?'dark':'light';
    document.documentElement.dataset.theme=theme;
    $('themeToggle').textContent=theme==='light'?'☾':'☀';
    try{localStorage.setItem(themeKey,theme);}catch(e){}
    chart();
  });
  render();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
}
init();
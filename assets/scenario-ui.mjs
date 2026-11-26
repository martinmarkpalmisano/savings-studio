import {EMPTY_SCENARIOS,exampleScenarios,saveScenario,renameScenario,deleteScenario,findScenario,validateScenarioLibrary} from './scenarios.mjs?v=14';
import {comparePair} from './comparison.mjs?v=14';

const KEY='savings-studio-scenarios-v1';
const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&#39;'}[ch]||'&#39;'));
const fmt=(n,currency)=>new Intl.NumberFormat(currency==='EUR'?'it-IT':'en-GB',{style:'currency',currency}).format(n);
const pct=n=>Number.isFinite(n)?n.toLocaleString('it-IT',{maximumFractionDigits:2})+'%':'—';

export function initScenarioUI({getSettings,applySettings,notify}){
  let library={...EMPTY_SCENARIOS,scenarios:[]};
  try{
    const raw=localStorage.getItem(KEY);
    if(raw)library=validateScenarioLibrary(JSON.parse(raw));
  }catch(e){notify('Saved scenarios could not be read. Existing data was not overwritten.');}
  const saveLibrary=next=>{
    const checked=validateScenarioLibrary(next);
    localStorage.setItem(KEY,JSON.stringify(checked));
    library=checked;
  };
  const error=e=>notify(e instanceof Error?e.message:String(e));
  const selectOptions=(id,prompt,selected)=>{
    const el=$(id);
    el.replaceChildren(new Option(prompt,''));
    for(const entry of library.scenarios)el.add(new Option(entry.name,entry.name));
    el.value=library.scenarios.some(x=>x.name===selected)?selected:'';
  };
  const selectedEntry=name=>{
    const entry=findScenario(library,name);
    if(!entry)throw Error('Choose a saved scenario.');
    return entry;
  };
  const drawComparison=()=>{
    const aName=$('compareLeft').value,bName=$('compareRight').value,container=$('comparisonResult');
    if(!aName||!bName){container.textContent='Select two saved scenarios to compare.';return;}
    if(aName===bName){container.textContent='Choose two different saved scenarios.';return;}
    const a=selectedEntry(aName),b=selectedEntry(bName);
    const rate=Number($('compareReinvest').value.trim().replace(',','.'));
    if(!Number.isFinite(rate)||rate<0||rate>100){
      container.textContent='Enter a coupon reinvestment rate between 0 and 100%.';return;
    }
    const horizon=Number($('compareMonths').value);
    let c;
    try{c=comparePair(a.settings,b.settings,horizon,rate);}catch(e){container.textContent=e.message;return;}
    const cards=[{name:a.name,...c.a},{name:b.name,...c.b}].map(s=>{
      const currency=s.settings.currency;
      if(!s.compatible){
        return '<article class="comparison-card"><strong>'+escapeHTML(s.name)+'</strong><p class="comparison-warning">'+escapeHTML(s.reason)+'</p></article>';
      }
      const fixed=s.settings.accountType==='fixed';
      const val=(label,value)=>'<div><dt>'+label+'</dt><dd>'+fmt(value,currency)+'</dd></div>';
      return '<article class="comparison-card"><strong>'+escapeHTML(s.name)+'</strong>'
        +'<span class="comparison-type">'+(fixed?'Fixed · '+s.settings.fixedTermMonths+' months':'Flexible · '+escapeHTML(s.settings.creditFrequency))+'</span>'
        +'<div class="comparison-profit">'+fmt(s.netProfit,currency)+'</div><span class="comparison-type">Net profit over '+horizon+' months</span>'
        +'<dl class="comparison-details">'
        +val('Initial capital',s.principal)+val('Total contributions',s.totalContributions)
        +val('After-tax interest',s.netInterest)
        +(fixed?val('Coupon reinvestment gain',s.reinvestInterest):'')
        +val('Stamp duty',-s.stampDuty)+val('Plan fees',-s.planFees)
        +val('Total wealth',s.closingWealth)
        +'<div><dt>Simple annual profit / starting capital</dt><dd>'+pct(s.annualisedSimpleNetReturn)+'</dd></div>'
        +'</dl></article>';
    }).join('');
    let summary='';
    if(a.settings.currency!==b.settings.currency){
      summary='<p class="comparison-warning">Different currencies. No exchange rate is applied; profit figures cannot be ranked.</p>';
    }else if(!c.comparable){
      summary='<p class="comparison-warning">A fixed deposit matures before the selected horizon. No automatic reinvestment or renewal is assumed. Choose a shorter horizon or another scenario.</p>';
    }else{
      const difference=Math.abs(c.difference);
      summary='<p class="comparison-winner"><strong>'+escapeHTML(c.difference>=0?a.name:b.name)+'</strong> projects '+fmt(difference,a.settings.currency)
        +(difference===0?' difference':' more net profit')+' over '+horizon+' months.</p>';
      if(!c.equalContributions)summary+='<p class="comparison-warning">Different amounts contributed: absolute profits are not directly like-for-like. The annual profit ratio is not IRR.</p>';
    }
    container.innerHTML='<div class="comparison-grid">'+cards+'</div>'+summary;
  };
  const draw=()=>{
    const selected=$('savedScenarioSelect').value,left=$('compareLeft').value,right=$('compareRight').value;
    selectOptions('savedScenarioSelect','Select a saved scenario',selected);
    selectOptions('compareLeft','Select scenario A',left);
    selectOptions('compareRight','Select scenario B',right);
    drawComparison();
  };
  $('saveScenarioBtn').addEventListener('click',()=>{
    try{
      const name=$('scenarioName').value.trim();
      const existing=findScenario(library,name);
      if(existing&&!window.confirm('Replace the saved scenario "'+name+'" with these settings?'))return;
      saveLibrary(saveScenario(library,name,getSettings()));
      draw();
      $('savedScenarioSelect').value=name.replace(/\s+/g,' ');
      notify(existing?'Saved scenario updated.':'Scenario saved on this browser.');
    }catch(e){error(e);}
  });
  $('loadScenarioBtn').addEventListener('click',()=>{
    try{
      const entry=selectedEntry($('savedScenarioSelect').value);
      $('scenarioName').value=entry.name;
      applySettings(entry.settings);
      notify('Loaded '+entry.name);
    }catch(e){error(e);}
  });
  $('renameScenarioBtn').addEventListener('click',()=>{
    try{
      const name=$('savedScenarioSelect').value;selectedEntry(name);
      const next=window.prompt('Rename saved scenario:',name);
      if(next===null)return;
      saveLibrary(renameScenario(library,name,next));draw();
      $('savedScenarioSelect').value=next.trim().replace(/\s+/g,' ');
      $('scenarioName').value=$('savedScenarioSelect').value;
      notify('Scenario renamed.');
    }catch(e){error(e);}
  });
  $('deleteScenarioBtn').addEventListener('click',()=>{
    try{
      const name=$('savedScenarioSelect').value;selectedEntry(name);
      if(!window.confirm('Delete saved scenario "'+name+'"?'))return;
      saveLibrary(deleteScenario(library,name));draw();
      notify('Scenario deleted.');
    }catch(e){error(e);}
  });
  $('savedScenarioSelect').addEventListener('change',e=>{
    if(e.target.value)$('scenarioName').value=e.target.value;
  });
  $('loadExampleBtn').addEventListener('click',()=>{
    const value=$('exampleScenarioSelect').value;
    if(!value){notify('Choose an example first.');return;}
    const example=exampleScenarios[Number(value)];
    if(!example){notify('Example unavailable.');return;}
    $('scenarioName').value=example.name.replace('Example · ','');
    applySettings(example.settings);
    notify('Example loaded. Adjust it, then choose Save current settings.');
  });
  ['compareLeft','compareRight','compareMonths','compareReinvest'].forEach(id=>
    $(id).addEventListener('change',drawComparison));
  $('exportScenariosBtn').addEventListener('click',()=>{
    try{
      const blob=new Blob([JSON.stringify(validateScenarioLibrary(library),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='savings-studio-scenarios.json';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
      notify('Saved scenarios exported.');
    }catch(e){error(e);}
  });
  $('importScenariosBtn').addEventListener('click',()=>$('importScenariosFile').click());
  $('importScenariosFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>500000)throw Error('Backup JSON exceeds 500 KB.');
      const incoming=validateScenarioLibrary(JSON.parse(await file.text()));
      const collision=incoming.scenarios.filter(item=>findScenario(library,item.name));
      if(collision.length&&!window.confirm('Import replaces '+collision.length+' same-named scenarios. Continue?'))return;
      let merged=library;
      for(const entry of incoming.scenarios)merged=saveScenario(merged,entry.name,entry.settings);
      saveLibrary(merged);draw();
      notify('Imported '+incoming.scenarios.length+' saved scenarios.');
    }catch(err){error(err);}
    finally{e.target.value='';}
  });
  draw();
}

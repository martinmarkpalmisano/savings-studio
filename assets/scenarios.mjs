import {DEFAULTS,normalizeSettings} from './calc.mjs?v=14';

export const SCENARIO_LIBRARY_VERSION=1;
export const SCENARIO_LIMIT=100;
export const exampleScenarios=Object.freeze([
  {name:'Example · Flexible tiered savings',settings:{...DEFAULTS,accountType:'flexible',initialBalance:60000,
    tieredInterest:true,threshold:15000,firstAER:3.5,excessAER:1,creditFrequency:'daily',years:5,
    stampDuty:false,monthlyFeeEnabled:false}},
  {name:'Example · 48-month fixed deposit',settings:{...DEFAULTS,accountType:'fixed',initialBalance:60000,
    firstAER:4.2,fixedTermMonths:48,fixedPayoutFrequency:'quarterly',
    stampDuty:true,stampRate:0.2,monthlyFeeEnabled:false}}
]);
const allowed=Object.keys(DEFAULTS);
export function cleanScenarioName(value){
  const name=String(value??'').trim().replace(/\s+/g,' ');
  if(!name||name.length>70||/[\u0000-\u001f\u007f]/.test(name))throw Error('Use a name between 1 and 70 characters.');
  return name;
}
export function normalizeScenarioSettings(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid scenario settings.');
  const fields={};
  for(const key of allowed)if(Object.prototype.hasOwnProperty.call(raw,key))fields[key]=raw[key];
  return normalizeSettings({...DEFAULTS,...fields});
}
export function validateScenarioLibrary(input){
  if(!input||typeof input!=='object'||input.version!==SCENARIO_LIBRARY_VERSION||!Array.isArray(input.scenarios))
    throw Error('This is not a Savings Studio scenario library (v1).');
  if(input.scenarios.length>SCENARIO_LIMIT)throw Error('Scenario library exceeds the 100-scenario limit.');
  const seen=new Set(),scenarios=[];
  for(const item of input.scenarios){
    const name=cleanScenarioName(item?.name);
    const key=name.toLocaleLowerCase();
    if(seen.has(key))throw Error('Duplicate scenario name: '+name);
    seen.add(key);
    scenarios.push({name,settings:normalizeScenarioSettings(item.settings)});
  }
  return {version:SCENARIO_LIBRARY_VERSION,scenarios};
}
export function saveScenario(library,name,rawSettings){
  const clean=cleanScenarioName(name),key=clean.toLocaleLowerCase();
  const base=validateScenarioLibrary(library);
  const settings=normalizeScenarioSettings(rawSettings);
  const index=base.scenarios.findIndex(s=>s.name.toLocaleLowerCase()===key);
  if(index>=0)base.scenarios[index]={name:clean,settings};
  else{
    if(base.scenarios.length>=SCENARIO_LIMIT)throw Error('Maximum of 100 saved scenarios reached.');
    base.scenarios.push({name:clean,settings});
  }
  base.scenarios.sort((a,b)=>a.name.localeCompare(b.name));
  return base;
}
export function renameScenario(library,oldName,newName){
  const base=validateScenarioLibrary(library),old=cleanScenarioName(oldName),next=cleanScenarioName(newName);
  const from=base.scenarios.findIndex(s=>s.name.toLocaleLowerCase()===old.toLocaleLowerCase());
  if(from<0)throw Error('Choose a saved scenario to rename.');
  if(base.scenarios.some((s,i)=>i!==from&&s.name.toLocaleLowerCase()===next.toLocaleLowerCase()))throw Error('A scenario with that name already exists.');
  base.scenarios[from].name=next;
  base.scenarios.sort((a,b)=>a.name.localeCompare(b.name));
  return base;
}
export function deleteScenario(library,name){
  const base=validateScenarioLibrary(library),key=cleanScenarioName(name).toLocaleLowerCase();
  const count=base.scenarios.length;
  base.scenarios=base.scenarios.filter(s=>s.name.toLocaleLowerCase()!==key);
  if(base.scenarios.length===count)throw Error('Saved scenario not found.');
  return base;
}
export function findScenario(library,name){
  return validateScenarioLibrary(library).scenarios.find(s=>s.name.toLocaleLowerCase()===String(name).toLocaleLowerCase())||null;
}
export const EMPTY_SCENARIOS=Object.freeze({version:1,scenarios:[]});

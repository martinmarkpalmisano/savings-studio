import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_SCENARIOS,exampleScenarios,saveScenario,renameScenario,deleteScenario,findScenario,validateScenarioLibrary} from '../assets/scenarios.mjs';

const flexible={accountType:'flexible',initialBalance:60000,firstAER:3.5,excessAER:1,threshold:15000,tieredInterest:true};
const fixed={accountType:'fixed',initialBalance:60000,firstAER:4.2,fixedTermMonths:48,fixedPayoutFrequency:'quarterly'};

test('save and load independently named flexible and fixed scenarios',()=>{
  let library=saveScenario(EMPTY_SCENARIOS,'Flexible Saver',flexible);
  library=saveScenario(library,'Four Year Bond',fixed);
  assert.equal(library.scenarios.length,2);
  assert.equal(findScenario(library,'flexible saver').settings.accountType,'flexible');
  assert.equal(findScenario(library,'four year bond').settings.fixedTermMonths,48);
});
test('updating the same name replaces scenario without duplicate',()=>{
  let library=saveScenario(EMPTY_SCENARIOS,'Bank A',flexible);
  library=saveScenario(library,'bank a',{...flexible,firstAER:2.1});
  assert.equal(library.scenarios.length,1);
  assert.equal(findScenario(library,'BANK A').settings.firstAER,2.1);
});
test('renaming preserves values and deleting removes only chosen scenario',()=>{
  let library=saveScenario(EMPTY_SCENARIOS,'Old name',fixed);
  library=saveScenario(library,'Keep',flexible);
  library=renameScenario(library,'Old name','New name');
  assert.equal(findScenario(library,'new name').settings.firstAER,4.2);
  assert.equal(findScenario(library,'Old name'),null);
  library=deleteScenario(library,'New name');
  assert.equal(library.scenarios.length,1);
  assert.equal(library.scenarios[0].name,'Keep');
});
test('backup JSON roundtrips without losing deposit terms and taxes',()=>{
  const library=saveScenario(EMPTY_SCENARIOS,'My deposit',{...fixed,stampDuty:true,stampRate:.2,taxRate:26});
  const restored=validateScenarioLibrary(JSON.parse(JSON.stringify(library)));
  assert.equal(restored.scenarios[0].settings.accountType,'fixed');
  assert.equal(restored.scenarios[0].settings.stampDuty,true);
  assert.equal(restored.scenarios[0].settings.fixedPayoutFrequency,'quarterly');
});
test('rejects duplicate names in imported library',()=>{
  const library=saveScenario(EMPTY_SCENARIOS,'One',fixed);
  library.scenarios.push({name:'one',settings:fixed});
  assert.throws(()=>validateScenarioLibrary(library),/Duplicate/);
});
test('rejects unknown format and empty scenario names',()=>{
  assert.throws(()=>validateScenarioLibrary({version:2,scenarios:[]}),/not a Savings Studio/);
  assert.throws(()=>saveScenario(EMPTY_SCENARIOS,'  ',flexible),/name/);
});
test('example scenarios remain generic and cover both account types',()=>{
  assert.equal(exampleScenarios.length,2);
  assert.ok(exampleScenarios.some(s=>s.settings.accountType==='flexible'));
  assert.ok(exampleScenarios.some(s=>s.settings.accountType==='fixed'));
});

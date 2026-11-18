import {
  defaultScenario, validateScenario, calculateScenario, compareScenarios,
  compareStrategies, annualToCsv, STRATEGIES,
} from './engine.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let scenario = defaultScenario();
let lastResult = null;
let sequence = 100;
const usd = (x) => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0}).format(x);
const shortUSD = (x) => x >= 1e6 ? '$'+(x/1e6).toFixed(2)+'m' : x >= 1000 ? '$'+(x/1000).toFixed(0)+'k' : usd(x);
const esc = (str) => String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asNumber = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const STRATEGY_LABELS = {
  'live-out':'Live-out nanny', 'live-in':'Live-in nanny', daycare:'Daycare + school', hybrid:'Family + nanny', custom:'Custom budget',
};

function getPath(path) { return path.split('.').reduce((obj, k)=>obj?.[k],scenario); }
function setPath(path, value) {
  const keys=path.split('.'), leaf=keys.pop();
  const obj=keys.reduce((a,k)=>a[k],scenario);
  obj[leaf]=value;
}
function bindStaticFields() {
  $$('[data-bind]').forEach(el=>{
    const val=getPath(el.dataset.bind);
    if(el.type==='checkbox') el.checked=Boolean(val);
    else el.value=val ?? '';
  });
  $$('input[name=strategy]').forEach(el=>el.checked===true ? el.checked=false : undefined);
  const chosen=$(`input[name=strategy][value="${scenario.care.mode}"]`);
  if(chosen) chosen.checked=true;
  updateCareVisibility();
}
function updateCareVisibility() {
  const mode=scenario.care.mode;
  $('#nanny-fields').hidden=!['live-out','live-in','hybrid'].includes(mode);
  $('#daycare-fields').hidden=mode!=='daycare';
  $('#custom-fields').hidden=mode!=='custom';
  $('#housing-field').hidden=mode!=='live-in';
  $('#family-field').hidden=mode!=='hybrid';
}
function renderDependents() {
  $('#dependent-rows').innerHTML=scenario.dependents.map((d,i)=>`<tr data-index="${i}">
    <td><label class="sr-only" for="dep-age-${i}">Dependent ${i+1} age</label><input id="dep-age-${i}" aria-label="Dependent ${i+1} current age" type="number" min="0" max="120" step="1" data-dep="${i}" data-key="age" value="${esc(d.age)}" /></td>
    <td><input aria-label="Dependent ${i+1} supported until age" type="number" min="0" max="120" step="1" data-dep="${i}" data-key="supportUntilAge" value="${esc(d.supportUntilAge)}" /></td>
    <td><div class="dep-extra"><input class="small-input" aria-label="Dependent ${i+1} extra school hours" type="number" min="0" max="168" step="1" data-dep="${i}" data-key="extraSchoolHours" value="${esc(d.extraSchoolHours)}" /> / <input class="small-input" aria-label="Dependent ${i+1} extra break hours" type="number" min="0" max="168" step="1" data-dep="${i}" data-key="extraBreakHours" value="${esc(d.extraBreakHours)}" /></div></td>
    <td><button type="button" class="remove-btn" data-remove-dependent="${i}" aria-label="Remove dependent ${i+1}" title="Remove dependent">×</button></td>
  </tr>`).join('') || '<tr><td colspan="4" class="hint">No dependents. Other care expenses can still be modeled below.</td></tr>';
}
function renderServices(){
  $('#service-rows').innerHTML=scenario.services.map((s,i)=>`<div class="service-item"><div class="service-item-top"><input type="text" maxlength="90" aria-label="Service ${i+1} name" data-service="${i}" data-key="name" value="${esc(s.name)}"/><button type="button" class="remove-btn" data-remove-service="${i}" aria-label="Remove service ${i+1}">×</button></div>
    <div class="service-fields"><label class="service-field">Hours / week<input aria-label="Service ${i+1} hours per week" type="number" min="0" max="168" step="1" data-service="${i}" data-key="hoursPerWeek" value="${esc(s.hoursPerWeek)}"/></label>
    <label class="service-field">Hourly rate ($)<input aria-label="Service ${i+1} hourly rate" type="number" min="0" step="1" data-service="${i}" data-key="hourlyRate" value="${esc(s.hourlyRate)}"/></label>
    <label class="service-field">Weeks / year<input aria-label="Service ${i+1} weeks per year" type="number" min="0" max="52" step="1" data-service="${i}" data-key="weeksPerYear" value="${esc(s.weeksPerYear)}"/></label>
    <label class="service-field">Years needed<input aria-label="Service ${i+1} years needed" type="number" min="0" max="80" step="1" data-service="${i}" data-key="endYear" value="${esc(s.endYear)}"/></label></div>
    <label class="service-check"><input type="checkbox" data-service="${i}" data-key="includedWithNanny" ${s.includedWithNanny?'checked':''}/> Covered by nanny when nanny is hired (no separate bill)</label></div>`).join('') || '<p class="hint">No additional replacement services.</p>';
}
function setText(id, value) { $(id).textContent=value; }
function row(label, value, klass='') {
  return `<div class="cost-row ${klass}"><span class="item">${esc(label)}</span><strong>${usd(value)}</strong></div>`;
}
function renderBreakdown(r) {
 $('#cost-breakdown').innerHTML=[
  row('Purchased childcare / care',r.pvCare), row('Other household services',r.pvServices),
  row('Lost take-home income',r.pvIncome), row('Other ongoing expenses',r.pvOther),
  row('One-time needs',r.oneTimeCosts), row('Gross present-value expense',r.grossPV),
  row('Verified yearly benefit reductions',-r.pvBenefits),
  row('Existing insurance + available assets',-r.resources),
  row('Estimated additional coverage',r.coverageNeed,'total')
 ].join('')+'<p class="hint">Annual benefit offsets are capped at that year’s expenses. The summary line for benefits may not exactly reconcile to coverage if annual benefits exceed annual needs.</p>';
}
function renderStrategyComparison() {
  const rows=compareStrategies(scenario);
  $('#strategy-comparison').innerHTML=rows.map(r=>`<div class="comparison-row ${r.mode===scenario.care.mode?'selected':''}"><span>${r.mode===scenario.care.mode?'● ':'○ '}${esc(STRATEGY_LABELS[r.mode])}</span><strong>${shortUSD(r.coverageNeed)}</strong></div>`).join('')+'<p class="hint">Changing strategy does not automatically change rate assumptions or provider availability. Verify alternatives before relying on their relative cost.</p>';
}
function renderChart(r) {
  const total=r.annual.length;
  const max=Math.max(1,...r.annual.map(a=>a.expense));
  const step=Math.max(1,Math.ceil(total/8));
  $('#cost-chart').innerHTML=`<div class="bar-chart" aria-hidden="true">${r.annual.map((a,i)=>`<div class="bar-col" title="Year ${a.year}: ${usd(a.expense)}"><div class="bar" style="height:${(a.expense/max*100).toFixed(2)}%"></div>${i%step===0||i===total-1?`<small>${a.year}</small>`:''}</div>`).join('')}</div><div class="chart-caption"><span>Year 1</span><span>Peak annual expense: ${usd(r.annualPeak)}</span><span>Year ${total}</span></div>`;
  $('#cost-chart').setAttribute('aria-label',`Annual expenses from ${usd(r.annual[0]?.expense || 0)} in year 1 to ${usd(r.annual[total-1]?.expense || 0)} in year ${total}; peak ${usd(r.annualPeak)}.`);
}
function renderTable(r) {
  $('#annual-rows').innerHTML=r.annual.map(y=>`<tr><td>${y.year}</td><td>${usd(y.care)}</td><td>${usd(y.services)}</td><td>${usd(y.income)}</td><td>${usd(y.other)}</td><td>${usd(y.benefits)}</td><td>${usd(y.unfunded)}</td><td>${usd(y.pvUnfunded)}</td></tr>`).join('');
}
function renderWarnings(r) {
 const additional=[];
 const c=scenario.care;
 if (['live-in','live-out','hybrid'].includes(c.mode) && c.employerBurdenPct<7.65) additional.push('Employer burden may be below federal payroll tax plus required state taxes and employment costs. Confirm locally.');
 if (c.mode==='daycare' && scenario.dependents.some(d=>d.age<scenario.schedule.schoolStartAge)) additional.push('Preschool daycare assumes each child has a place; center-based care may not cover early/late shifts, illness or transportation.');
 if (scenario.dependents.length && scenario.dependents.some(d=>d.supportUntilAge<=d.age)) additional.push('One or more dependents have a support end age at or below their current age and are not included in future childcare.');
 const warnings=[...r.warnings,...additional];
 $('#warnings').innerHTML=warnings.map(w=>`<p>⚠ ${esc(w)}</p>`).join('');
}
function renderResults() {
  const problems=validateScenario(scenario);
  if(problems.length) {
    $('#errors').hidden=false; $('#errors').textContent=problems.join(' '); return;
  }
  $('#errors').hidden=true;
  try {
    const scenarios=compareScenarios(scenario), r=scenarios.base;
    lastResult=r;
    setText('#coverage-amount', usd(r.coverageNeed));
    setText('#rounded-suggestion',`Suggested rounded coverage: ${usd(r.roundedCoverage)} (rounded up in $50,000 increments)`);
    setText('#first-year',usd(r.firstYearExpense));
    setText('#term-years', r.lastNeedYear ? `~${r.suggestedTermYears} years` : 'No ongoing need');
    $('#scenario-results').innerHTML=[['Low',scenarios.low],['Base',r],['High',scenarios.high]].map(([n,v])=>`<div><small>${n}</small><strong>${shortUSD(v.coverageNeed)}</strong></div>`).join('');
    renderBreakdown(r); renderStrategyComparison(); renderChart(r); renderTable(r); renderWarnings(r);
  } catch (e) {
    $('#errors').hidden=false; $('#errors').textContent=`Cannot calculate this scenario: ${e.message}`;
  }
}
function download(filename, body, mime) {
 const blob=new Blob([body],{type:mime});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a'); anchor.href=url; anchor.download=filename;
 document.body.appendChild(anchor); anchor.click(); anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function installEvents() {
 document.addEventListener('input',(ev)=>{
  const el=ev.target;
  if (el.matches('[data-bind]')) {
    setPath(el.dataset.bind,el.type==='checkbox'?el.checked:asNumber(el.value)); renderResults();
  } else if (el.matches('[data-dep]')) {
    scenario.dependents[Number(el.dataset.dep)][el.dataset.key]=asNumber(el.value);renderResults();
  } else if (el.matches('[data-service]')) {
    scenario.services[Number(el.dataset.service)][el.dataset.key]=el.type==='checkbox'?el.checked:el.type==='text'?el.value:asNumber(el.value);
    renderResults();
  }
 });
 document.addEventListener('change',(ev)=>{
  if(ev.target.matches('input[name="strategy"]')) {scenario.care.mode=ev.target.value;updateCareVisibility();renderResults();}
 });
 document.addEventListener('click',(ev)=>{
  const removeDep=ev.target.closest('[data-remove-dependent]');
  if(removeDep){scenario.dependents.splice(Number(removeDep.dataset.removeDependent),1); renderDependents();renderResults();return;}
  const removeService=ev.target.closest('[data-remove-service]');
  if(removeService){scenario.services.splice(Number(removeService.dataset.removeService),1);renderServices();renderResults();}
 });
 $('#add-dependent').addEventListener('click',()=>{if(scenario.dependents.length>=100)return;scenario.dependents.push({id:`d${++sequence}`,age:0,supportUntilAge:18,extraSchoolHours:0,extraBreakHours:0});renderDependents();renderResults();});
 $('#add-service').addEventListener('click',()=>{if(scenario.services.length>=100)return;scenario.services.push({id:`s${++sequence}`,name:'New service',hoursPerWeek:5,hourlyRate:25,weeksPerYear:52,endYear:15,includedWithNanny:false});renderServices();renderResults();});
 $('#download-json').addEventListener('click',()=>download('care-replacement-scenario.json',JSON.stringify(scenario,null,2)+'\n','application/json'));
 $('#download-csv').addEventListener('click',()=>lastResult && download('care-replacement-annual.csv',annualToCsv(lastResult.annual),'text/csv'));
 $('#print-report').addEventListener('click',()=>window.print());
 $('#reset-scenario').addEventListener('click',()=>{scenario=defaultScenario();renderAll();window.scrollTo({top:0,behavior:'smooth'});});
 $('#range-info').addEventListener('click',()=>window.alert('Low: childcare and household service rates 20% below baseline. High: 25% above baseline. The other financial inputs are held fixed. These are illustrative scenarios, not probability intervals.'));
 $('#load-json').addEventListener('change',async(ev)=>{
   const f=ev.target.files?.[0]; if(!f)return;
   if(f.size>100000){window.alert('Scenario file is too large (100 KB maximum).'); ev.target.value='';return;}
   try{
     const loaded=JSON.parse(await f.text()); const errors=validateScenario(loaded);
     if(errors.length) throw new Error(errors.join(' '));
     // Merge with defaults to handle optional fields, retaining only model-defined keys.
     const defaults=defaultScenario();
     scenario={...defaults,...loaded,schedule:{...defaults.schedule,...loaded.schedule},care:{...defaults.care,...loaded.care},finances:{...defaults.finances,...loaded.finances},
       dependents:loaded.dependents.map(d=>({...defaults.dependents[0],...d})),
       services:loaded.services.map(s=>({id:'import',name:'Service',hoursPerWeek:0,hourlyRate:0,weeksPerYear:0,endYear:0,includedWithNanny:false,...s}))};
     renderAll();
   }catch(e){window.alert('Could not load scenario: '+e.message);}
   ev.target.value='';
 });
}
function renderAll(){bindStaticFields();renderDependents();renderServices();renderResults();}
installEvents();renderAll();
if('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

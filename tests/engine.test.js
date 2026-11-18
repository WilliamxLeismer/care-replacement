import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultScenario, calculateScenario, compareScenarios, compareStrategies, weeklyCareNeeds, nannyWeeklyWages, annualCareCosts, annualServiceCosts, validateScenario, annualToCsv} from '../src/engine.js';
const fixture = () => defaultScenario();
const close = (a,b,t=0.02) => assert.ok(Math.abs(a-b)<t, `Expected ${a} approximately ${b}`);
test('Default input is valid and produces a coverage estimate',()=>{
 const s=fixture(), r=calculateScenario(s); assert.deepEqual(validateScenario(s),[]); assert.ok(r.coverageNeed>0); assert.equal(r.annual.length,25);
});
test('Four children and unchanged survivor income do not assume income loss',()=>{
 const s=fixture(); s.dependents=[1,4,9,12].map((age,i)=>({id:String(i),age,supportUntilAge:18,extraSchoolHours:0,extraBreakHours:0})); s.care.mode='live-in';
 const r=calculateScenario(s); assert.equal(r.pvIncome,0); assert.ok(r.pvCare>0); assert.ok(r.annual.every(x=>x.income===0));
});
test('Sibling nanny supervision is not summed across children',()=>{
 const s=fixture(); s.dependents.push({id:'third',age:4,supportUntilAge:18,extraSchoolHours:0,extraBreakHours:0});
 const c=weeklyCareNeeds(s,1); assert.equal(c.schoolHours,45); assert.equal(c.breakHours,45);
});
test('Non-exempt 50-hour week pays overtime; 40-hour does not',()=>{
 close(nannyWeeklyWages(50,25,true,40), 40*25 + 10*25*1.5);
 close(nannyWeeklyWages(50,25,false,40),1250);
 close(nannyWeeklyWages(40,25,true,40),1000);
});
test('School-age transitions adjust care in the next year',()=>{
 const s=fixture(); s.dependents=[{id:'1',age:5,supportUntilAge:18,extraSchoolHours:0,extraBreakHours:0}];
 assert.equal(weeklyCareNeeds(s,1).schoolHours,45); assert.equal(weeklyCareNeeds(s,2).schoolHours,20);
});
test('Care terminates at support end age and can extend to adult dependent',()=>{
 const s=fixture(); s.dependents=[{id:'1',age:17,supportUntilAge:30,extraSchoolHours:25,extraBreakHours:25}];
 assert.equal(weeklyCareNeeds(s,1).schoolHours,33); assert.equal(weeklyCareNeeds(s,2).schoolHours,25); assert.equal(weeklyCareNeeds(s,14).schoolHours,0);
});
test('Daycare counts dependents individually, while family supported nanny reduces purchased hours',()=>{
 const s=fixture(); s.dependents=[{id:'a',age:2,supportUntilAge:18,extraSchoolHours:0,extraBreakHours:0},{id:'b',age:4,supportUntilAge:18,extraSchoolHours:0,extraBreakHours:0}];
 s.care.mode='daycare'; close(annualCareCosts(s,1).daycare,2*325*52);
 s.care.mode='live-out'; const full=annualCareCosts(s,1).total;
 s.care.mode='hybrid'; s.care.familyCoveragePct=50; assert.ok(annualCareCosts(s,1).total<full);
});
test('Included nanny duties not charged twice; they return when paid nanny ends',()=>{
 const s=fixture(); s.services[0].includedWithNanny=true; const active=annualCareCosts(s,1); assert.ok(active.nannyCovered);
 const withNanny=annualServiceCosts(s,1,true), without=annualServiceCosts(s,1,false);
 assert.ok(withNanny.total<without.total); assert.ok(withNanny.excluded>0);
});
test('No dependents and no other costs yields zero coverage',()=>{
 const s=fixture(); s.dependents=[]; s.services=[]; s.finances.funeralCost=0; s.finances.transitionCost=0;
 assert.equal(calculateScenario(s).coverageNeed,0);
});
test('PV end-year timing matches independent geometric discount example',()=>{
 const s=fixture(); s.dependents=[]; s.services=[]; s.finances.horizonYears=2;
 s.finances.funeralCost=0; s.finances.transitionCost=0;
 s.finances.otherAnnual=1000; s.finances.otherYears=2;
 s.finances.inflationPct=0; s.finances.discountRatePct=10;
 close(calculateScenario(s).coverageNeed,1000/1.1+1000/(1.1**2));
});
test('Costs rise with higher rate and coverage falls with more available assets',()=>{
 const s=fixture(); const a=calculateScenario(s).coverageNeed;
 s.care.hourlyRate*=1.5; const b=calculateScenario(s).coverageNeed;
 assert.ok(b>a); s.finances.dedicatedAssets=100000; const c=calculateScenario(s).coverageNeed;
 assert.ok(c<b);
});
test('Excess annual benefits cannot become negative funding requirements',()=>{
 const s=fixture(); s.dependents=[]; s.services=[]; s.finances.funeralCost=0; s.finances.transitionCost=0;
 s.finances.survivorBenefitsAnnual=100000; s.finances.survivorBenefitsYears=10;
 assert.equal(calculateScenario(s).coverageNeed,0);
});
test('Nominal wage escalation and discounting are separate',()=>{
 const s=fixture(); s.dependents=[]; s.services=[]; s.finances.funeralCost=0; s.finances.transitionCost=0;
 s.finances.otherAnnual=1000; s.finances.otherYears=2; s.finances.horizonYears=2;
 s.finances.inflationPct=10; s.finances.discountRatePct=10;
 close(calculateScenario(s).coverageNeed,1000/1.1+1100/1.21);
});
test('Live-in adds housing only with active care, and overtime is opt-out',()=>{
 const s=fixture(); s.care.mode='live-in'; const a=annualCareCosts(s,1);
 s.care.mode='live-out'; const b=annualCareCosts(s,1);
 close(a.total-b.total,s.care.housingAnnual);
 s.care.overtime=false; const c=annualCareCosts(s,1);
 assert.ok(c.total<b.total);
});
test('Scenarios and strategy comparison are ordered and consistent',()=>{
 const s=fixture(), results=compareScenarios(s); assert.ok(results.low.coverageNeed <= results.base.coverageNeed); assert.ok(results.high.coverageNeed>=results.base.coverageNeed);
 const strategies=compareStrategies(s); assert.equal(strategies.length,5);
 assert.ok(strategies.every(x=>Number.isFinite(x.coverageNeed)));
});
test('Malformed scenarios are rejected',()=>{
 assert.ok(validateScenario({}).length>0);
 const s=fixture(); s.finances.horizonYears=90; assert.ok(validateScenario(s).length>0);
});
test('CSV export includes one row per modeled year',()=>{
 const out=annualToCsv(calculateScenario(fixture()).annual).split('\r\n'); assert.equal(out.length,26); assert.ok(out[0].includes('pvUnfunded'));
});
/**
 * Care Replacement - deterministic, dependency-free financial model.
 * All amounts are USD. Annual costs occur at END of year 1..N.
 * Today's wages grow by wageGrowth from year 2; year-1 costs are undiscounted input dollars.
 * One-time expenses and existing liquid resources are valued at t=0.
 */

export const SCHEMA_VERSION = 1;
export const STRATEGIES = ['live-out', 'live-in', 'daycare', 'hybrid', 'custom'];
export const STAGES = [
  { id: 'preschool', label: 'Before school', from: 0 },
  { id: 'school', label: 'School-age', from: 6 },
  { id: 'teen', label: 'Teen', from: 13 },
];

const num = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
const nonneg = (x) => Math.max(0, num(x));
const clamp = (x, min, max) => Math.min(max, Math.max(min, num(x)));
const money = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const safeYears = (x) => Math.floor(clamp(x, 0, 80));

export function defaultScenario() {
  return {
    version: SCHEMA_VERSION,
    dependents: [
      { id: 'd1', age: 3, supportUntilAge: 18, extraSchoolHours: 0, extraBreakHours: 0 },
      { id: 'd2', age: 8, supportUntilAge: 18, extraSchoolHours: 0, extraBreakHours: 0 },
    ],
    schedule: {
      schoolStartAge: 6, teenStartAge: 13, adultAge: 18, schoolWeeks: 40, breakWeeks: 12,
      preschoolSchoolHours: 45, preschoolBreakHours: 45,
      schoolSchoolHours: 20, schoolBreakHours: 45,
      teenSchoolHours: 8, teenBreakHours: 15,
    },
    care: {
      mode: 'live-out', hourlyRate: 28, overtime: true, overtimeAfterHours: 40,
      employerBurdenPct: 12, payrollAnnual: 800, backupAnnual: 2500,
      housingAnnual: 6000, familyCoveragePct: 30,
      daycarePreschoolWeekly: 325, afterSchoolWeekly: 135,
      summerCampWeekly: 300, teenCampWeekly: 0,
      customAnnual: 50000, customYears: 12,
    },
    services: [
      { id: 's1', name: 'Cleaning and laundry', hoursPerWeek: 5, hourlyRate: 25, weeksPerYear: 52, endYear: 18, includedWithNanny: false },
      { id: 's2', name: 'Meals and errands', hoursPerWeek: 5, hourlyRate: 25, weeksPerYear: 52, endYear: 18, includedWithNanny: false },
    ],
    finances: {
      horizonYears: 25, wageGrowthPct: 3, inflationPct: 2.5, discountRatePct: 4.5,
      lostInsuredNetAnnual: 0, lostInsuredYears: 0,
      survivorIncomeReductionAnnual: 0, survivorIncomeReductionYears: 0,
      otherAnnual: 0, otherYears: 0,
      survivorBenefitsAnnual: 0, survivorBenefitsYears: 0,
      existingInsurance: 0, dedicatedAssets: 0,
      funeralCost: 12000, transitionCost: 10000, debtPayoff: 0,
    },
  };
}

export function validateScenario(s) {
  const issues = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) return ['Scenario must be an object.'];
  if (s.version !== SCHEMA_VERSION) issues.push(`Expected scenario version ${SCHEMA_VERSION}.`);
  if (!Array.isArray(s.dependents) || s.dependents.length > 100) issues.push('Provide an array of up to 100 dependents.');
  if (!Array.isArray(s.services) || s.services.length > 100) issues.push('Provide an array of up to 100 services.');
  if (!s.schedule || typeof s.schedule !== 'object') issues.push('Missing care schedule.');
  if (!s.care || !STRATEGIES.includes(s.care.mode)) issues.push('Invalid care strategy.');
  if (!s.finances || typeof s.finances !== 'object') issues.push('Missing financial assumptions.');
  if (issues.length) return issues;
  const f = s.finances, t = s.schedule;
  if (num(f.horizonYears) < 1 || num(f.horizonYears) > 80) issues.push('Planning horizon must be between 1 and 80 years.');
  if (num(f.discountRatePct) <= -100 || num(f.wageGrowthPct) <= -100 || num(f.inflationPct) <= -100) issues.push('Growth and return must exceed -100%.');
  if (nonneg(t.schoolWeeks) + nonneg(t.breakWeeks) > 52.2) issues.push('School and break weeks must total no more than 52.');
  if (num(t.schoolStartAge) >= num(t.teenStartAge) || num(t.teenStartAge) > num(t.adultAge)) issues.push('Care stage ages must be increasing.');
  for (const [i, d] of s.dependents.entries()) {
    if (!d || !Number.isFinite(Number(d.age)) || num(d.age) < 0 || num(d.age) > 120) issues.push(`Dependent ${i+1} has an invalid age.`);
    if (num(d.supportUntilAge) < 0 || num(d.supportUntilAge) > 120) issues.push(`Dependent ${i+1} has an invalid support end age.`);
  }
  return issues;
}

function stageForAge(age, s) {
  if (age < s.schoolStartAge) return 'preschool';
  if (age < s.teenStartAge) return 'school';
  if (age < s.adultAge) return 'teen';
  return 'adult';
}

export function weeklyCareNeeds(s, year) {
  const school = s.schedule;
  let schoolHours = 0, breakHours = 0, active = 0, preschool = 0, schoolAge = 0, teen = 0;
  for (const d of s.dependents) {
    const age = nonneg(d.age) + year - 1;
    if (age >= nonneg(d.supportUntilAge)) continue;
    active++;
    const stage = stageForAge(age, school);
    const schoolBase = stage === 'adult' ? 0 : nonneg(school[`${stage}SchoolHours`]);
    const breakBase = stage === 'adult' ? 0 : nonneg(school[`${stage}BreakHours`]);
    // Maximum, not sum: one paid adult can supervise siblings concurrently.
    schoolHours = Math.max(schoolHours, schoolBase + nonneg(d.extraSchoolHours));
    breakHours = Math.max(breakHours, breakBase + nonneg(d.extraBreakHours));
    if (stage === 'preschool') preschool++;
    else if (stage === 'school') schoolAge++;
    else if (stage === 'teen') teen++;
  }
  return { schoolHours, breakHours, active, preschool, schoolAge, teen };
}

export function nannyWeeklyWages(hours, rate, overtime, overtimeAfterHours = 40) {
  const h = nonneg(hours), r = nonneg(rate), threshold = nonneg(overtimeAfterHours);
  if (!overtime) return h * r;
  return (Math.min(h, threshold) + 1.5 * Math.max(0, h - threshold)) * r;
}

export function annualCareCosts(s, year) {
  const c = s.care, needs = weeklyCareNeeds(s, year), school = s.schedule;
  const mode = c.mode;
  const weeksSchool = nonneg(school.schoolWeeks), weeksBreak = nonneg(school.breakWeeks);
  const inflationFactor = Math.pow(1 + num(s.finances.wageGrowthPct) / 100, year - 1);
  let wages = 0, burden = 0, employerCosts = 0, housing = 0, daycare = 0;
  let nannyCovered = false;
  if (mode === 'live-out' || mode === 'live-in' || mode === 'hybrid') {
    const unpaidFraction = mode === 'hybrid' ? 1 - clamp(c.familyCoveragePct, 0, 100) / 100 : 1;
    const schoolHours = needs.schoolHours * unpaidFraction;
    const breakHours = needs.breakHours * unpaidFraction;
    nannyCovered = schoolHours > 0 || breakHours > 0;
    if (nannyCovered) {
      wages = (nannyWeeklyWages(schoolHours, c.hourlyRate, c.overtime, c.overtimeAfterHours) * weeksSchool +
        nannyWeeklyWages(breakHours, c.hourlyRate, c.overtime, c.overtimeAfterHours) * weeksBreak) * inflationFactor;
      burden = wages * nonneg(c.employerBurdenPct) / 100;
      employerCosts = (nonneg(c.payrollAnnual) + nonneg(c.backupAnnual)) * inflationFactor;
      housing = mode === 'live-in' ? nonneg(c.housingAnnual) * inflationFactor : 0;
    }
  } else if (mode === 'daycare') {
    daycare = (
      needs.preschool * nonneg(c.daycarePreschoolWeekly) * (weeksSchool + weeksBreak) +
      needs.schoolAge * (nonneg(c.afterSchoolWeekly) * weeksSchool + nonneg(c.summerCampWeekly) * weeksBreak) +
      needs.teen * nonneg(c.teenCampWeekly) * weeksBreak
    ) * inflationFactor;
    // For a dependent who needs adult care, use custom service rather than inventing daycare provision.
  } else if (mode === 'custom' && year <= safeYears(c.customYears)) {
    daycare = nonneg(c.customAnnual) * inflationFactor;
  }
  const total = wages + burden + employerCosts + housing + daycare;
  return { total, wages, burden, employerCosts, housing, daycare, nannyCovered, needs };
}

export function annualServiceCosts(s, year, hasNanny) {
  const wageFactor = Math.pow(1 + num(s.finances.wageGrowthPct) / 100, year - 1);
  let total = 0, excluded = 0;
  const details = [];
  for (const svc of s.services) {
    const eligible = year <= safeYears(svc.endYear);
    const cost = eligible ? nonneg(svc.hoursPerWeek) * nonneg(svc.hourlyRate) * clamp(svc.weeksPerYear, 0, 52) * wageFactor : 0;
    const covered = eligible && hasNanny && Boolean(svc.includedWithNanny);
    total += covered ? 0 : cost;
    excluded += covered ? cost : 0;
    details.push({ name: String(svc.name ?? 'Other service'), cost: covered ? 0 : cost, excluded: covered ? cost : 0 });
  }
  return { total, excluded, details };
}

function annualRepeat(base, years, year, growthFactor) {
  return year <= safeYears(years) ? nonneg(base) * Math.pow(growthFactor, year - 1) : 0;
}

export function calculateScenario(s, careCostMultiplier = 1) {
  const issues = validateScenario(s);
  if (issues.length) throw new Error(issues.join(' '));
  const f = s.finances;
  const horizon = safeYears(f.horizonYears);
  const costGrowth = 1 + num(f.inflationPct) / 100;
  const discount = 1 + num(f.discountRatePct) / 100;
  const annual = [];
  let pvCare = 0, pvServices = 0, pvIncome = 0, pvOther = 0, pvBenefits = 0, pvUnmet = 0;
  for (let year = 1; year <= horizon; year++) {
    const care = annualCareCosts(s, year);
    const chores = annualServiceCosts(s, year, care.nannyCovered);
    const careCost = (care.total + chores.total) * careCostMultiplier;
    const income = annualRepeat(f.lostInsuredNetAnnual, f.lostInsuredYears, year, costGrowth) +
      annualRepeat(f.survivorIncomeReductionAnnual, f.survivorIncomeReductionYears, year, costGrowth);
    const other = annualRepeat(f.otherAnnual, f.otherYears, year, costGrowth);
    // Benefits are fixed nominally unless the user changes them: COLAs are not guaranteed.
    const benefits = year <= safeYears(f.survivorBenefitsYears) ? nonneg(f.survivorBenefitsAnnual) : 0;
    const expense = careCost + income + other;
    const unfunded = Math.max(0, expense - benefits);
    const factor = Math.pow(discount, year); // End-of-year convention
    pvCare += care.total * careCostMultiplier / factor;
    pvServices += chores.total * careCostMultiplier / factor;
    pvIncome += income / factor;
    pvOther += other / factor;
    pvBenefits += benefits / factor;
    pvUnmet += unfunded / factor;
    annual.push({
      year, care: money(care.total * careCostMultiplier), services: money(chores.total * careCostMultiplier),
      income: money(income), other: money(other), benefits: money(benefits),
      expense: money(expense), unfunded: money(unfunded), pvUnfunded: money(unfunded / factor),
      hoursSchool: money(care.needs.schoolHours), hoursBreak: money(care.needs.breakHours),
      activeDependents: care.needs.active, excludedOverlap: money(chores.excluded),
    });
  }
  const oneTimeCosts = nonneg(f.funeralCost) + nonneg(f.transitionCost) + nonneg(f.debtPayoff);
  const resources = nonneg(f.existingInsurance) + nonneg(f.dedicatedAssets);
  const grossPV = pvCare + pvServices + pvIncome + pvOther + oneTimeCosts;
  const unmetBeforeAssets = pvUnmet + oneTimeCosts;
  const need = Math.max(0, unmetBeforeAssets - resources);
  const lastNeedYear = [...annual].reverse().find(x=>x.unfunded>0.01)?.year ?? 0;
  const terms = [5, 10, 15, 20, 25, 30, 35, 40];
  const suggestedTermYears = lastNeedYear ? (terms.find(t=>t>=lastNeedYear) || lastNeedYear) : 0;
  const warnings = [];
  if (s.care.mode === 'live-in') warnings.push('Live-in housing does not mean 24-hour on-duty care. Confirm actual compensable hours and applicable law.');
  if (!s.care.overtime && ['live-out','live-in','hybrid'].includes(s.care.mode)) warnings.push('Overtime is disabled. Verify whether a lawful exemption applies, including state/local restrictions.');
  if (s.dependents.some(d => nonneg(d.supportUntilAge) - nonneg(d.age) > horizon)) warnings.push('At least one dependent may need continued support beyond the modeled horizon. Increase the horizon if appropriate.');
  if (s.dependents.some(d => nonneg(d.supportUntilAge) > nonneg(s.schedule.adultAge) && nonneg(d.extraSchoolHours) + nonneg(d.extraBreakHours) === 0)) warnings.push('An adult dependent has an extended support end age but no adult care hours. Add individual extra care hours or a paid service.');
  if (['live-out', 'live-in', 'hybrid'].includes(s.care.mode) && s.services.some(x=>x.includedWithNanny)) warnings.push('Excluded chores assume a nanny can perform those duties within paid hours. Check available time and job scope.');
  if (s.care.mode==='daycare' && s.dependents.some(d=>nonneg(d.supportUntilAge)>nonneg(s.schedule.adultAge))) warnings.push('Daycare strategy does not automatically cover adult-dependent care; add custom services.');
  return {
    annual, warnings, grossPV: money(grossPV), pvCare: money(pvCare), pvServices: money(pvServices),
    pvIncome: money(pvIncome), pvOther: money(pvOther), pvBenefits: money(pvBenefits),
    unmetBeforeAssets: money(unmetBeforeAssets), oneTimeCosts: money(oneTimeCosts), resources: money(resources),
    coverageNeed: money(need), roundedCoverage: Math.ceil(need / 50000) * 50000,
    lastNeedYear, suggestedTermYears, firstYearExpense: annual[0]?.expense ?? 0,
    annualPeak: Math.max(0, ...annual.map(a=>a.expense)),
  };
}

export function compareScenarios(s) {
  return {
    low: calculateScenario(s, 0.8),
    base: calculateScenario(s),
    high: calculateScenario(s, 1.25),
  };
}

export function compareStrategies(s) {
  return STRATEGIES.map(mode => {
    const copy = structuredClone(s);
    copy.care.mode = mode;
    return { mode, ...calculateScenario(copy) };
  });
}

export const annualToCsv = (annual) => {
  const keys=['year','care','services','income','other','benefits','expense','unfunded','pvUnfunded','hoursSchool','hoursBreak','activeDependents','excludedOverlap'];
  return [keys.join(','), ...annual.map(y=>keys.map(k=>y[k]).join(','))].join('\r\n');
};

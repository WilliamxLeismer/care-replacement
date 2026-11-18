# Care Replacement: requirements and roadmap

**Goal:** Estimate life insurance needed to replace the incremental, future out-of-pocket services and earnings lost when a parent or caregiver dies. Public, open-source, US-first, mobile-friendly, client-side.

## Required MVP
- R01: Any number of dependents, individual ages, support end age and special care needs.
- R02: Lost earnings and survivor work disruption entered independently, including zero income change.
- R03: Age-based school-week and break-week care hours and editable transition ages.
- R04: Nanny, live-in nanny, daycare, shared family care and custom budgets.
- R05: Hourly wages, overtime, employer burdens, backup care and housing.
- R06: Household labor service replacements for cleaning, meals, transport and other duties.
- R07: Avoid overlapping sibling nanny hours and separately billed nanny-covered tasks.
- R08: Year-by-year expenses with explicit planning horizon.
- R09: Wage inflation, general inflation, nominal investment rate, existing insurance, liquid assets, verified benefits and one-time expenses.
- R10: Present-value unmet funding need, rounded coverage and term estimates; low/base/high care cost scenarios.
- R11: Explainable breakdown, annual costs graph, and cash-flow table.
- R12: Private mobile-first UI, no login, email collection, or underwriting funnel.
- R13: Download/upload JSON scenarios, annual CSV, printable summary, and offline use after first load.
- R14: Unit testing for financial math, care stages, overlapping care and offsets.
- R15: Overtime and live-in labor-law warnings; no assumption of automatic overtime exemption.

## Next improvements
- Regional BLS wage data with cited year and location (not interchangeable with market nanny quotes).
- Region-aware employer tax and state labor law guidance.
- More advanced schedule modeling: overlapping shifts, multiple caregivers and workdays.
- More thorough insurance term ladder comparison, insurance premium quotes excluded.
- Printable report with family scenario charts and comparison of low/base/high.
- Browser-level automated tests and accessibility audits.

## Math
Annual cash flows occur at the *end* of years 1 through N. Wage/service costs escalate at an editable nominal wage rate; income disruption and other costs escalate at general inflation. Benefits remain nominally fixed and cannot offset more than that year's expenses. End-of-year unfunded needs are discounted at a nominal discount rate. One-time expenses and available assets are applied at time zero.

Coverage = max(0, Σ max(0, annual expense - annual survivor benefits) / (1+r)^t + one-time costs - existing insurance - dedicated assets).

This is a *planning estimate*, not tax, labor, investment or insurance advice. Consult IRS Publication 926, US DOL 79B and 79D, SSA survivor-benefits rules, and independent local provider quotes.
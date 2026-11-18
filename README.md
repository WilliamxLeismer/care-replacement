# Care Replacement

A free, private, open-source calculator for estimating the life insurance needed to replace childcare, caregiving and unpaid household labor if a person dies. It works even when the insured person has **zero earned income** and the survivor continues working with unchanged income.

**Repository:** https://github.com/WilliamxLeismer/care-replacement

**Web app (once GitHub Pages is enabled):** https://williamxleismer.github.io/care-replacement/

## What it can do

- Model any number of dependents, with individual ages, end-of-support ages, and additional care needs.
- Project evolving weekly care hours by childhood stage, school year and school breaks. Nanny hours for siblings use the **maximum overlapping coverage requirement**, not a sum of all child hours.
- Switch between live-out nanny, live-in nanny, daycare + school care, partial family-supported nanny, or a custom annual care budget.
- Budget overtime (enabled by default), employee costs, backup care, and extra costs of providing live-in housing.
- Account for cleaning, meal preparation, transportation, custom services and overlaps with nanny duties.
- Optionally include lost insured income, reductions in surviving income, survivor benefits, existing life insurance, accessible assets and one-time costs.
- Compare low/base/high service-cost estimates; view a year-by-year schedule and present-value funding requirement.
- Export an annual CSV or a local scenario JSON; print the results as a report. Data is calculated in the browser, without any remote processing, analytics, cookies, or sign-in.

## Calculation conventions

For years `t = 1 .. horizon`, annual expenses (care + services + income reduction + other needs) are calculated at current year-1 prices, then escalated annually. Recurring benefits are **fixed nominally** by default and can offset only the expense of the same year. Negative annual needs are floored at zero. This is deliberately conservative.

```text
annual_gap[t] = max(0, annual_expense[t] - verified_survivor_benefits[t])
PV_gap = sum(annual_gap[t] / (1 + nominal_discount_rate)^t)
coverage = max(0, PV_gap + one_time_costs - existing_insurance - available_assets)
```

Annual cash flows occur at each year's **end**. One-time costs and existing insurance/assets are assumed available immediately. Service cost escalation uses an editable wage growth rate. Income losses/other ongoing costs use general inflation. Future benefits are fixed nominally unless independently modeled elsewhere. Suggested policy sizes are **rounded up** to increments of $50,000. The coverage horizon is the last year with an annual funding shortfall, rounded to a nearby available term where possible.

### Critical simplifications

- Hours for siblings are assumed to overlap perfectly and one caregiver can supervise them together. In reality, staffing may require multiple shifts, vehicles, specialized training or separate carers. Increase hours or add services accordingly.
- Live-in employment **does not mean 24/7 paid availability**. Overtime laws depend on who employs the worker, where they live, federal/state/local rules, and compensated hours. Overtime remains enabled by default even for live-in nannies; disabling it requires independent confirmation.
- The example wages, costs, hours and interest rates are illustrative, **not current regional quotes**. No jurisdiction-specific payroll calculation is included. Employer burden is a user-supplied budget factor, not an automated tax filing computation.
- Household chores marked as covered by the nanny are removed from separate service spending whenever the nanny is employed. The user must confirm job scope, availability and capacity.
- This calculator does not model tax treatment of insurance proceeds, insurance premiums, Social Security benefits eligibility, state assistance, medical expenses, guardianship law, market volatility, mortality probabilities, or long-term individualized underwriting.
- It is a planning tool, not a recommendation to purchase a policy of any particular amount.

## Local use and tests

No third-party packages required. Node 20+ is needed only for tests.

```bash
npm test
python3 -m http.server 8080
# open http://localhost:8080
```

Offline use after a successful first network visit is provided by a service worker. Open the app through HTTPS or localhost, not by opening `index.html` as a `file://` URL.

The UI uses HTML/CSS and native JavaScript modules instead of React/Vite. This intentional change from the original architecture plan removes all runtime/build dependencies, makes GitHub Pages delivery direct and testable offline, and avoids package-supply-chain and build setup for a small static calculator. The finance engine is isolated in `src/engine.js`, so migrating the view to a UI framework would not require rewriting calculation logic.

## Deploy to GitHub Pages

The `.github/workflows/pages.yml` workflow tests on every push to `main` and then publishes the repository as a static Pages artifact. **One-time repository configuration may be required**:

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **GitHub Actions** as the publishing source.
3. Run the **Test and deploy to GitHub Pages** workflow or push to `main`.
4. Open `https://williamxleismer.github.io/care-replacement/` and verify the live calculator.

The site uses relative URLs, so it works at the `/care-replacement/` project path without a Vite `base` setting.

## Source references

- [2026 IRS Publication 926: Household Employer’s Tax Guide](https://www.irs.gov/publications/p926)
- [US DOL 79B: Live-in domestic service workers](https://www.dol.gov/agencies/whd/fact-sheets/79b-flsa-live-in-domestic-workers)
- [US DOL 79D: Domestic service hours worked](https://www.dol.gov/agencies/whd/fact-sheets/79d-flsa-domestic-service-hours-worked)
- [BLS Occupational Employment and Wage Statistics](https://www.bls.gov/oes/tables.htm)
- [SSA survivor eligibility](https://www.ssa.gov/survivor/eligibility)
- [Life Happens needs calculator](https://lifehappens.org/life-insurance-needs-calculator/)

See [REQUIREMENTS.md](REQUIREMENTS.md) for full specification, scope, and future roadmap.

## Privacy and license

Scenario files are saved only when requested by the user and can include sensitive family composition and financial details. **Do not publish exported personal scenarios in a public repository.** The program does not transmit the user's scenario. Source code is [MIT licensed](LICENSE).

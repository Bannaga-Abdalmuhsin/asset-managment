// S1–S4 scenario formulas adapted from Cow-Risk-Dashboard_new/artifacts/hajj-dashboard/src/lib/calculations.ts.
// Site classification uses scenario flags only; no fixed field-status override.
// Snapshot input: risk-sites.json (79 surveyed Hajj sites). Values remain in source units.
(function (global) {
  'use strict';
  const FACTOR = .8 * .87 * .9;
  const definitions = [
    ['Prime power · AC1 · normal','prime','ac1',false],
    ['Prime power · AC1+AC2 · normal','prime','both',false],
    ['Prime power · AC1 · charging','prime','both',true],
    ['Prime power · AC1+AC2 · charging','prime','both',true]
  ];
  function analyze(raw) {
    const id = String(raw.cowId).trim().toUpperCase();
    const sg = raw.powerSource === 'SG';
    const primeNet = sg || raw.powerSource === 'DG' ? raw.primeGenNetPowerKw : raw.primeSecNetPowerKw;
    // Source converts spreadsheet net kW into kVA / FACTOR at age zero,
    // then applies generator net-power formula kVA × .8 × .87 × .9.
    const prime = (primeNet / FACTOR) * FACTOR * (1 - .03 * 0);
    const backupNet = sg ? 0 : raw.backupGenNetPowerKw;
    const backup = (backupNet / FACTOR) * FACTOR * (1 - .03 * 0);
    const ac1 = raw.ac1CapacityBtu * .83 * (1 - .015 * raw.ac1AgeYears);
    const ac2 = raw.ac2CapacityBtu > 0 ? raw.ac2CapacityBtu * .83 * (1 - .015 * raw.ac2AgeYears) : 0;
    const ac1Kw = ac1 / 3412 / 3.5;
    const ac2Kw = ac2 / 3412 / 3.5;
    const telecom = raw.telecomLoadTotalKw || raw.telecomLoadAllKw;
    const heat = raw.telecomHeatDissipationKbtuh; // Original value is Btu/h despite the column name.
    // The source passes heat / 1000 into SiteConfig and multiplies it by 1000 in the engine.
    const chargingKw = .05 * (raw.batteriesCapacityAh * raw.numStrings) * 48 / 1000;
    const hours = raw.batteriesMaxUsefulTimeHours;
    const scenarios = definitions.map(([name,source,cooling,charging],i) => {
      const number = i + 1;
      const available = prime;
      let powerMargin = available - ac1Kw - telecom;
      if ([2,4].includes(number)) powerMargin -= ac2Kw;
      if (charging) powerMargin -= chargingKw;
      const rectifierMargin = raw.rectifierCapacityKw - telecom - (charging ? chargingKw : 0);
      const coolingMargin = (cooling === 'ac1' ? ac1 : ac1 + ac2) - heat;
      const flags = {
        power: powerMargin < 0,
        rectifier: rectifierMargin < 0,
        cooling: raw.shelterType.toLowerCase() !== 'outdoor' && coolingMargin < 0,
        battery: false
      };
      const actionable = Object.values(flags).some(Boolean);
      return { id:number, name, powerSource:source, coolingConfig:cooling,
        batteryState:charging?'charging':'normal',
        flags, actionable,
        powerMarginKw:powerMargin, rectifierMarginKw:rectifierMargin,
        coolingMarginBtu:coolingMargin, batteryUsefulHours:hours,
        primePowerKw:prime, backupPowerKw:backup,
        telecomPowerKw:telecom, telecomHeatBtu:heat,
        ac1NetBtu:ac1, ac2NetBtu:ac2, ac1NetPowerKw:ac1Kw,
        ac2NetPowerKw:ac2Kw, rectifierNetKw:raw.rectifierCapacityKw,
        batteryChargingKw:chargingKw,
        riskScore:Number(flags.power)+Number(flags.rectifier)+Number(flags.cooling) };
    });
    const riskScenarios = scenarios.filter(s => s.actionable);
    const overallRisk = riskScenarios.length > 0;
    return { id, overallRisk, scenarios, riskScenarios, scenarioCount:scenarios.length,
      flaggedScenarioCount:riskScenarios.length,
      worstRiskScore:Math.max(...scenarios.map(s=>s.riskScore)) };
  }
  global.CowRisk = { analyze };
})(window);

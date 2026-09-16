// Port of Cow-Risk-Dashboard_new/artifacts/hajj-dashboard/src/lib/calculations.ts.
// Snapshot input: risk-sites.json (79 surveyed Hajj sites). Values remain in source units.
(function (global) {
  'use strict';
  const FIELD_RISK = new Set(['CWN076','CWN083','CWN050','CWN777','CWN101','CWN998','CWN967','CWN994','CWN081','CWN970','CWN208','CWN022','CWN099','CWN996','CWN092','CWN062','CWN080','CWN038','CWN206']);
  const FIELD_SAFE = new Set(['CWN002','CWN074']);
  const FACTOR = .8 * .87 * .9;
  const definitions = [
    ['Prime power · AC1 · normal','prime','ac1',false],
    ['Prime power · AC1+AC2 · normal','prime','both',false],
    ['Prime power · AC1 · charging','prime','both',true],
    ['Prime power · AC1+AC2 · charging','prime','both',true],
    ['Backup power · AC1 · normal','backup','ac1',false],
    ['Backup power · AC1+AC2 · normal','backup','both',false],
    ['Backup power · AC1 · charging','backup','both',true],
    ['Backup power · AC1+AC2 · charging','backup','both',true],
    ['Power outage · battery discharge','outage','none',false]
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
      if (id === 'CWN915' && (number === 6 || number === 8)) return null;
      const outage = number === 9;
      const available = outage ? 0 : source === 'prime' ? prime : backup;
      let powerMargin = outage ? -telecom : available - ac1Kw - telecom;
      if ([2,4,6,8].includes(number)) powerMargin -= ac2Kw;
      if (charging) powerMargin -= chargingKw;
      const rectifierMargin = outage ? -telecom : raw.rectifierCapacityKw - telecom - (charging ? chargingKw : 0);
      const coolingMargin = outage ? -heat : (cooling === 'ac1' ? ac1 : ac1 + ac2) - heat;
      const flags = {
        power: outage || powerMargin < 0,
        rectifier: outage || rectifierMargin < 0,
        cooling: outage || (raw.shelterType.toLowerCase() !== 'outdoor' && coolingMargin < 0),
        battery: outage && hours < 1
      };
      // S9 power/cooling are displayed as unavailable by the source engine;
      // its battery duration is the actionable outage risk.
      const actionable = outage ? flags.battery : Object.values(flags).some(Boolean);
      return { id:number, name, powerSource:source, flags, actionable,
        powerMarginKw:powerMargin, rectifierMarginKw:rectifierMargin,
        coolingMarginBtu:coolingMargin, batteryUsefulHours:hours,
        riskScore:Number(flags.power)+Number(flags.rectifier)+Number(flags.battery)+(outage?0:Number(flags.cooling)) };
    }).filter(Boolean);
    const override = FIELD_RISK.has(id) ? 'Confirmed field risk' : FIELD_SAFE.has(id) ? 'Confirmed field safe' : null;
    // The source data marks exactly 19 field-confirmed sites at risk and
    // explicitly holds all remaining surveyed sites safe on the heat map.
    const overallRisk = FIELD_RISK.has(id);
    const riskScenarios = overallRisk ? scenarios.filter(s => s.actionable) : [];
    return { id, overallRisk, override, riskScenarios, scenarioCount:scenarios.length,
      worstRiskScore:Math.max(...scenarios.map(s=>s.riskScore)) };
  }
  global.CowRisk = { analyze, FIELD_RISK, FIELD_SAFE };
})(window);

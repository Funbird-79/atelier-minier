"use strict";

const stockIds = {
  drive: "qdrv_just_s02_huracan_scitem",
  shield: "shld_behr_s03_5ca_scitem",
  power: "powr_just_s03_ginzel_scitem",
  cooler: "cool_just_s03_thermalcore_scitem",
  radar: "radr_chco_s02_surveyor",
  jump: "jdrv_tars_s02_excelsior_scitem",
  flight: "controller_flight_argo_mole",
  paint: null
};
const laserSlots = ["laser0", "laser1", "laser2"];
const gunSlots = ["gun0", "gun1"];
const podSlots = Array.from({ length: 8 }, (_, i) => "pod" + i);
const moduleSlots = (slot) => Array.from({ length: 3 }, (_, i) => "module" + slot.at(-1) + "-" + i);
for (const slot of laserSlots) {
  stockIds[slot] = "mining_laser_grin_arbor_s2";
  for (const module of moduleSlots(slot)) stockIds[module] = null;
}
for (const slot of gunSlots) stockIds[slot] = "klwe_laserrepeater_s2";
for (const slot of podSlots) stockIds[slot] = "cargo_shipmining_pod_mole";

const profiles = {
  balanced: { ...stockIds, power: "powr_just_s03_durango_scitem", cooler: "cool_just_s03_chillmax_scitem" },
  stock: stockIds
};
const componentIndex = new Map(Object.values(ARGO_DATA.parts).flat().map((part) => [part.id, part]));
const slotGroup = (slot) => slot.replace(/\d.*$/, "");
const baseSlot = (loadout, slot) => componentIndex.get(loadout[slot]?.id);

function defaultLoadout(profile) {
  return Object.fromEntries(Object.entries(profiles[profile]).map(([slot, id]) => [slot, { id, quality: null }]));
}

function validQualities(recipe, qualities) {
  return Array.isArray(qualities) && qualities.length === recipe.ingredients.length
    && recipe.ingredients.every(({ min }, i) =>
      Number.isInteger(qualities[i]) && qualities[i] >= min && qualities[i] <= 1000);
}

function restoreLoadout(saved) {
  const selection = defaultLoadout("balanced");
  for (const slot of Object.keys(selection)) {
    const record = saved?.[slot];
    const choices = ARGO_DATA.parts[slotGroup(slot)];
    if (record?.id === null && stockIds[slot] === null) selection[slot] = { id: null, quality: null };
    const item = choices.find(({ id }) => id === record?.id);
    if (item) {
      selection[slot] = { id: item.id,
        quality: item.recipe && validQualities(item.recipe, record.quality) ? record.quality : null };
    }
  }
  for (const slot of laserSlots) {
    for (const key of moduleSlots(slot).slice(baseSlot(selection, slot).slots)) {
      selection[key] = { id: null, quality: null };
    }
  }
  return selection;
}

function evaluateCurve(segments, quality) {
  const [min, max, start, end] = segments.find(([, upper]) => quality <= upper) ?? segments.at(-1);
  if (max === min) return start;
  return start + (end - start) * Math.max(0, Math.min(1, (quality - min) / (max - min)));
}

const modifierStats = {
  health_maxhealth: ["hp"],
  quantum_speed: ["speed"],
  quantum_fuelrequirement: ["burn"],
  shield_maxhealth: ["shield"],
  itemresource_powergeneration: ["output"],
  itemresource_coolantgeneration: ["cooling"],
  radar_minaimassistdistance: ["assistMin"],
  radar_maxaimassistdistance: ["assistMax"],
  weapon_damage: ["dps", "alpha", "beam", "beamMin"]
};

function qualityEffects(recipe, qualities) {
  const changes = {};
  for (const [i, ingredient] of recipe.ingredients.entries()) {
    for (const [key, additive, segments] of ingredient.modifiers) {
      const value = evaluateCurve(segments, qualities[i]);
      const effect = changes[key] ??= { fraction: 0, fixed: 0 };
      if (additive) effect.fixed += value;
      else effect.fraction += value - 1;
    }
  }
  return changes;
}

function effectiveStats(item, qualities) {
  if (!item) return {};
  const stats = { ...item.stats };
  if (item.recipe && qualities) {
    for (const [key, { fraction, fixed }] of Object.entries(qualityEffects(item.recipe, qualities))) {
      for (const stat of modifierStats[key]) {
        if (Number.isFinite(stats[stat])) stats[stat] = stats[stat] * (1 + fraction) + fixed;
      }
    }
  }
  return stats;
}

const loadoutStats = (loadout, slot) => effectiveStats(baseSlot(loadout, slot), loadout[slot]?.quality);
const distanceBetween = (a, b) => Math.hypot(...a.coords.map((value, i) => value - b.coords[i]));

function travelTime(drive, stats, distance) {
  if (distance <= 0) return 0;
  const [a1, a2, engage] = drive.accel;
  const transition = Math.min(engage, stats.speed);
  const firstTime = transition / a1;
  const secondTime = 2 * (stats.speed - transition) / (a1 + a2);
  const firstDistance = transition * firstTime / 2;
  const halfDistance = distance * 1000 / 2;
  if (halfDistance <= firstDistance) return stats.spool + 2 * Math.sqrt(2 * halfDistance / a1);

  // Follow the measured model: acceleration rises linearly during stage two,
  // with symmetric braking. Distances inside this formula are in Mm.
  const ramp = secondTime === 0 ? 0 : (a2 - a1) / secondTime;
  const secondDistance = (t) => transition * t + a1 * t ** 2 / 2 + ramp * t ** 3 / 6;
  const cruiseStart = firstDistance + secondDistance(secondTime);
  if (halfDistance >= cruiseStart) {
    return stats.spool + 2 * (firstTime + secondTime + (halfDistance - cruiseStart) / stats.speed);
  }
  let low = 0;
  let high = secondTime;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (firstDistance + secondDistance(mid) < halfDistance) low = mid;
    else high = mid;
  }
  return stats.spool + 2 * (firstTime + (low + high) / 2);
}

function routeLegs(from, to) {
  if (from.system === to.system) return [{ from, to, distance: distanceBetween(from, to) }];
  const gateFrom = ARGO_DATA.points[ARGO_DATA.gates[from.system][to.system]];
  const gateTo = ARGO_DATA.points[ARGO_DATA.gates[to.system][from.system]];
  return [
    { from, to: gateFrom, distance: distanceBetween(from, gateFrom) },
    { from: gateFrom, to: gateTo, distance: null },
    { from: gateTo, to, distance: distanceBetween(gateTo, to) }
  ];
}

function routeTotals(legs, roundTrip, loadout) {
  const component = baseSlot(loadout, "drive");
  const stats = loadoutStats(loadout, "drive");
  const jumps = legs.filter(({ distance }) => distance !== null);
  const distance = jumps.reduce((total, jump) => total + jump.distance, 0);
  const seconds = jumps.reduce((total, jump) => total + travelTime(component, stats, jump.distance), 0);
  const multiplier = roundTrip ? 2 : 1;
  return { distance: distance * multiplier, seconds: seconds * multiplier,
    fuel: distance * stats.burn * multiplier, oneWayFuel: distance * stats.burn };
}

function passiveMiningEffect(loadout, slot, key) {
  const head = baseSlot(loadout, slot);
  const bonuses = moduleSlots(slot).slice(0, head.slots)
    .map((id) => baseSlot(loadout, id)).filter((module) => module && !module.active);
  return bonuses.reduce((total, module) => total + (module.effects[key] ?? 0), head.effects[key] ?? 0);
}

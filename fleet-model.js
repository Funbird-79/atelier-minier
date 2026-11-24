"use strict";

const FleetModel = (() => {
  const mappedStats = {
    health_maxhealth: ["hp"], quantum_speed: ["speed"], quantum_fuelrequirement: ["burn"],
    shield_maxhealth: ["shield"], itemresource_powergeneration: ["output"],
    itemresource_coolantgeneration: ["cooling"], radar_minaimassistdistance: ["assistMin"],
    radar_maxaimassistdistance: ["assistMax"], weapon_damage: ["dps", "alpha", "beam", "beamMin"],
    weapon_hullscraping_efficiency: ["scrapeEfficiency"], weapon_hullscraping_radius: ["scrapeRadius"],
    weapon_hullscraping_speed: ["scrapeSpeed"]
  };
  function curve(segments, quality) {
    const [min, max, first, last] = segments.find(([, upper]) => quality <= upper) ?? segments.at(-1);
    return max === min ? first : first + (last - first) * Math.max(0, Math.min(1, (quality - min) / (max - min)));
  }
  function validQuality(recipe, values) {
    return recipe && Array.isArray(values) && values.length === recipe.ingredients.length
      && recipe.ingredients.every((item, index) => Number.isInteger(values[index])
        && values[index] >= item.min && values[index] <= 1000);
  }
  function qualityChanges(recipe, values) {
    const changes = {};
    if (!validQuality(recipe, values)) return changes;
    recipe.ingredients.forEach((item, index) => item.modifiers.forEach(([key, additive, segments]) => {
      const change = changes[key] ??= { fraction: 0, fixed: 0 };
      const value = curve(segments, values[index]);
      if (additive) change.fixed += value;
      else change.fraction += value - 1;
    }));
    return changes;
  }
  function effective(part, quality) {
    if (!part) return {};
    const stats = { ...part.stats };
    for (const [key, { fraction, fixed }] of Object.entries(qualityChanges(part.recipe, quality))) {
      for (const stat of mappedStats[key] ?? []) {
        if (Number.isFinite(stats[stat])) stats[stat] = stats[stat] * (1 + fraction) + fixed;
      }
    }
    return stats;
  }
  const item = (loadout, slot) => FLEET_DATA.parts[loadout[slot]?.id];
  const stats = (loadout, slot) => effective(item(loadout, slot), loadout[slot]?.quality);
  const slotsOf = (ship, group) => ship.slots.filter(slot => slot.group === group);
  function tidy(ship, loadout) {
    for (const slot of slotsOf(ship, "module")) {
      if (slot.moduleIndex >= (item(loadout, slot.parent)?.slots ?? 0)) loadout[slot.id] = { id: null, quality: null };
    }
    return loadout;
  }
  function defaults(ship, profile = "balanced") {
    return tidy(ship, Object.fromEntries(ship.slots.map(slot => [slot.id, { id: ship[profile][slot.id], quality: null }])));
  }
  function restore(ship, saved) {
    const loadout = defaults(ship);
    for (const slot of ship.slots) {
      const record = saved?.[slot.id];
      if (record?.id === null && slot.stock === null) loadout[slot.id] = { id: null, quality: null };
      else if (slot.choices.includes(record?.id)) {
        const selected = FLEET_DATA.parts[record.id];
        loadout[slot.id] = { id: record.id,
          quality: slot.editable && validQuality(selected.recipe, record.quality) ? record.quality : null };
      }
    }
    return tidy(ship, loadout);
  }
  const sum = (ship, loadout, group, stat) => slotsOf(ship, group)
    .reduce((total, slot) => total + (stats(loadout, slot.id)[stat] ?? 0), 0);
  function mining(ship, loadout, slotId, activeModules = false) {
    const head = item(loadout, slotId);
    if (!head) return { stats: {}, effects: {}, pieces: [] };
    const pieces = [head, ...slotsOf(ship, "module").filter(slot => slot.parent === slotId && slot.moduleIndex < head.slots)
      .map(slot => item(loadout, slot.id)).filter(module => module && (!module.active || activeModules))];
    const effects = {};
    for (const piece of pieces) for (const [key, value] of Object.entries(piece.effects ?? {})) {
      effects[key] = (effects[key] ?? 0) + value;
    }
    const values = stats(loadout, slotId);
    return { pieces, effects, stats: { ...values,
      beam: values.beam * (1 + (effects.FracturePower ?? 0) / 100),
      beamMin: values.beamMin * (1 + (effects.FracturePower ?? 0) / 100),
      extraction: values.extraction * (1 + (effects.ExtractionPower ?? 0) / 100) } };
  }
  function travelTime(drive, values, distance) {
    if (!drive || distance <= 0) return 0;
    const [a1, a2, engage] = drive.accel;
    const speed = values.speed;
    const transition = Math.min(engage, speed);
    const firstTime = transition / a1;
    const secondTime = 2 * (speed - transition) / (a1 + a2);
    const firstDistance = transition * firstTime / 2;
    const halfDistance = distance * 1000 / 2;
    if (halfDistance <= firstDistance) return values.spool + 2 * Math.sqrt(2 * halfDistance / a1);
    const ramp = secondTime ? (a2 - a1) / secondTime : 0;
    const secondDistance = t => transition * t + a1 * t ** 2 / 2 + ramp * t ** 3 / 6;
    const cruiseStart = firstDistance + secondDistance(secondTime);
    if (halfDistance >= cruiseStart) return values.spool + 2 * (firstTime + secondTime + (halfDistance - cruiseStart) / speed);
    let low = 0, high = secondTime;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (firstDistance + secondDistance(mid) < halfDistance) low = mid;
      else high = mid;
    }
    return values.spool + 2 * (firstTime + (low + high) / 2);
  }
  const distanceBetween = (a, b) => Math.hypot(...a.coords.map((value, index) => value - b.coords[index]));
  function legs(from, to) {
    if (from.system === to.system) return [{ from, to, distance: distanceBetween(from, to) }];
    const a = FLEET_DATA.points[FLEET_DATA.gates[from.system][to.system]];
    const b = FLEET_DATA.points[FLEET_DATA.gates[to.system][from.system]];
    return [{ from, to: a, distance: distanceBetween(from, a) }, { from: a, to: b, distance: null },
      { from: b, to, distance: distanceBetween(b, to) }];
  }
  function route(ship, loadout, routeLegs, roundTrip) {
    const drive = slotsOf(ship, "drive")[0];
    const values = stats(loadout, drive.id);
    const jumps = routeLegs.filter(leg => leg.distance !== null);
    const factor = roundTrip ? 2 : 1;
    const distance = factor * jumps.reduce((total, leg) => total + leg.distance, 0);
    return { distance, fuel: distance * values.burn,
      seconds: factor * jumps.reduce((total, leg) => total + travelTime(item(loadout, drive.id), values, leg.distance), 0) };
  }
  return { effective, qualityChanges, validQuality, curve, item, stats, slotsOf, tidy, defaults, restore, sum, mining, legs, route, mappedStats };
})();

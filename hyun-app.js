"use strict";

const byId = (id) => document.getElementById(id);
const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => escapes[character]);
const formats = Array.from({ length: 7 }, (_, maximumFractionDigits) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits }));
const format = (value, precision = 0) => formats[precision].format(value);
const signed = (value, precision = 0) => (value >= 0 ? "+" : "−") + format(Math.abs(value), precision);
const fieldContainer = byId("fields");
const hudPanel = byId("mining-hud");
const hudTurret = byId("hud-turret");
const base = defaultLoadout("stock");
const storageKey = "atelier-minier-hyun-loadout-v1";
const systemNames = { nyx: "Nyx", stanton: "Stanton", pyro: "Pyro" };
const defaultPoints = {
  nyx: ["Levski", "Transit Point Glaciem Bravo"],
  stanton: ["Seraphim Station", "Everus Harbor"],
  pyro: ["Checkmate", "Ruin Station"]
};
const labels = {
  drive: "Moteur quantique", shield: "Bouclier", power: "Centrale électrique",
  cooler: "Refroidisseur", radar: "Radar principal", jump: "Module de saut",
  flight: "Contrôleur de vol", laser0: "Laser central", laser1: "Laser gauche",
  laser2: "Laser droit", gun0: "Canon gauche", gun1: "Canon droit", paint: "Peinture"
};
Object.assign(labels, {
  shield0: "Bouclier gauche", shield1: "Bouclier droit", cooler0: "Refroidisseur 1", cooler1: "Refroidisseur 2",
  laser0: "Bras de minage", gun0: "Canon bas gauche", gun1: "Canon bas droit", gun2: "Canon gauche", gun3: "Canon droit",
  lifesupport: "Support de vie", salvage0: "Tête de salvage gauche", salvage1: "Tête de salvage droite",
  scraper0: "Abrade gauche", scraper1: "Abrade droit"
});
for (const [index, key] of podSlots.entries()) labels[key] = "Pod " + (index + 1);
for (const slot of laserSlots) {
  for (const [index, key] of moduleSlots(slot).entries()) {
    labels[key] = "Module " + (index + 1) + " · " + labels[slot].toLowerCase();
  }
}

const statLabels = {
  speed: ["Pointe quantique", "Mm/s", 1],
  range: ["Portée sur un plein", "Gm", 0],
  burn: ["Consommation quantique", "SCU/Gm", 6, -1],
  spool: ["Mise en route", "s", 1, -1],
  cooldown: ["Délai entre sauts", "s", 1, -1],
  shield: ["Capacité du bouclier", "HP", 0],
  regen: ["Régénération du bouclier", "HP/s", 0],
  damageDelay: ["Délai après un impact", "s", 2, -1],
  down: ["Délai après rupture", "s", 2, -1],
  output: ["Puissance de la centrale", "unités", 0],
  cooling: ["Débit du refroidisseur", "unités", 1],
  assistMin: ["Distance min. d’aide à la visée", "m", 1],
  assistMax: ["Distance max. d’aide à la visée", "m", 1],
  sensitivity: ["Sensibilité radar aux roches (RS)", "%", 0],
  hp: ["Intégrité", "HP", 0],
  em: ["Signature EM", "", 0, -1],
  ir: ["Signature IR", "", 0, -1],
  load: ["Consommation électrique", "unités", 1, -1],
  beam: ["Puissance de fracture max.", "unités", 1],
  beamMin: ["Puissance de fracture min.", "unités", 1],
  optimal: ["Portée optimale", "m", 0],
  distance: ["Portée maximale", "m", 0],
  extraction: ["Puissance d’extraction", "unités", 0],
  dps: ["Dégâts bruts par seconde", "DPS", 1],
  alpha: ["Dégâts par salve", "HP", 1],
  cargo: ["Capacité de minerai", "SCU", 0],
  scrapeSpeed: ["Coefficient de vitesse", "%", 1],
  scrapeRadius: ["Rayon du décapage", "×", 2],
  scrapeEfficiency: ["Efficacité de récupération", "%", 1]
};
const classLabels = { Civilian: "civil", Industrial: "industriel", Military: "militaire", Stealth: "furtif", Competition: "compétition" };
const paintViews = {
  stock: "stock",
  paint_hyun_white_grey_gold: "chiing",
  paint_hyun_pink_purple_black: "suii",
  paint_hyun_blue_gold: "chuia",
  paint_hyun_black_black_black: "hyaotan"
};
const modifierLabels = {
  health_maxhealth: "Intégrité", quantum_speed: "Vitesse quantique",
  quantum_fuelrequirement: "Consommation quantique", shield_maxhealth: "Capacité du bouclier",
  itemresource_powergeneration: "Puissance", itemresource_coolantgeneration: "Refroidissement",
  radar_minaimassistdistance: "Aide à la visée (min.)", radar_maxaimassistdistance: "Aide à la visée (max.)",
  weapon_damage: "Puissance du laser ou dégâts",
  weapon_hullscraping_efficiency: "Efficacité du décapage",
  weapon_hullscraping_radius: "Rayon du décapage",
  weapon_hullscraping_speed: "Vitesse du décapage"
};
const materialLabels = { Iron: "Fer", Copper: "Cuivre", Tungsten: "Tungstène", Titanium: "Titane", Aluminum: "Aluminium", "Pressurized Ice": "Glace sous pression", Silver: "Argent", Gold: "Or", Diamond: "Diamant" };
const miningEffects = {
  FracturePower: ["Puissance de fracture", 1],
  Resistance: ["Résistance de la roche", -1],
  Instability: ["Instabilité", -1],
  OptimalChargeWindow: ["Largeur de la zone verte", 1],
  OptimalChargeRate: ["Vitesse de progression de la fracture", 1],
  OverchargeRate: ["Vitesse de surcharge", -1],
  ShatterDamage: ["Dégâts de fragmentation", -1],
  ExtractionPower: ["Puissance d’extraction", 1],
  InertMaterials: ["Matières inertes collectées", -1]
};
const hudAreas = {
  range: {
    title: "Portée du laser",
    description: "Sur la jauge de gauche, le repère OPTIMAL t’aide à placer la tourelle à la bonne distance de la roche.",
    stats: ["optimal", "distance"], effects: []
  },
  rock: {
    title: "Résistance et instabilité",
    description: "Au scan, une résistance plus basse facilite la montée en charge. Une instabilité plus basse rend cette charge plus régulière.",
    effects: ["Resistance", "Instability"]
  },
  window: {
    title: "Zone verte · Fracture",
    description: "Une zone verte plus large donne plus de marge. Une progression plus rapide réduit le temps à maintenir la charge dans le vert.",
    effects: ["OptimalChargeWindow", "OptimalChargeRate"]
  },
  overcharge: {
    title: "Zone rouge · Surcharge",
    description: "En zone rouge, un taux de surcharge plus élevé remplit le compteur plus vite. Les dégâts de fragmentation modifient les dégâts au moment de la rupture.",
    effects: ["OverchargeRate", "ShatterDamage"]
  },
  power: {
    title: "Intensité et puissance",
    description: "L’intensité affichée correspond au réglage de la molette. La tête, la qualité de fabrication et les modules de fracture déterminent la puissance disponible.",
    stats: ["beam", "beamMin"], effects: ["FracturePower"]
  },
  extraction: {
    title: "Après fracture · Extraction",
    description: "En mode extraction, une puissance supérieure accélère la collecte. La filtration réduit la part de matières inertes aspirée.",
    stats: ["extraction"], effects: ["ExtractionPower", "InertMaterials"]
  },
  all: {
    title: "Effets par pièce",
    description: "Les flèches indiquent les valeurs qui montent ou descendent. Les pourcentages indiquent le modificateur propre à chaque pièce.",
    stats: ["beam", "beamMin", "optimal", "distance", "extraction"], effects: Object.keys(miningEffects)
  }
};

let current;
try { current = restoreLoadout(JSON.parse(localStorage.getItem(storageKey))); }
catch { current = defaultLoadout("balanced"); }
let category = "systems";
let routeMode = "map";
let hudArea = "window";
let craftSlot;

function saveLoadout() {
  try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* The tool also works without browser storage. */ }
}

function profileName() {
  const match = Object.entries(profiles).find(([, ids]) => Object.entries(ids).every(
    ([slot, id]) => current[slot].id === id && !current[slot].quality));
  return match?.[0];
}

function partName(part) {
  if (!part) return "Aucun";
  const type = classLabels[part.kind];
  if (Number.isFinite(part.stats.cargo)) return part.name + " · " + format(part.stats.cargo) + " SCU";
  return part.name + (type ? " · " + type + " " + part.grade : "");
}

function field(slot, options = {}) {
  const part = baseSlot(current, slot);
  const group = slotGroup(slot);
  const list = ARGO_DATA.parts[group];
  const crafted = current[slot].quality !== null;
  const label = options.label ?? labels[slot];
  const emptyName = group === "paint" ? "Livrée d’origine" : "Emplacement vide";
  const size = list[0].size;
  const locked = list.length === 1 && stockIds[slot] !== null;
  let choice = stockIds[slot] === null
    ? `<option value="">${emptyName}</option>` : "";
  for (const option of list) {
    choice += `<option value="${option.id}" ${option.id === part?.id ? "selected" : ""}>${escapeText(partName(option))}</option>`;
  }
  const blueprint = part?.recipe
    ? `<button type="button" class="secondary ${crafted ? "crafted" : ""}" data-craft="${slot}" aria-label="Blueprint de ${escapeText(part.name)} (${escapeText(labels[slot])})">${crafted ? "Fabriquée" : "Blueprint"}</button>` : "";
  return `<div class="field">
    <label for="slot-${slot}">${escapeText(label)} <span>S${size}</span></label>
    <div class="field-control"><select id="slot-${slot}" data-slot="${slot}" ${locked ? "disabled" : ""}>${choice}</select>${blueprint}</div>
    ${options.note ? "<small>" + escapeText(options.note) + "</small>" : ""}
  </div>`;
}

function moduleUsage(module) {
  return module.active ? `Actif · ${module.charges} utilisations de ${module.seconds} s` : "Passif";
}

function moduleNote(module) {
  if (!module) return "";
  const effects = Object.entries(miningEffects).flatMap(([key, [label]]) => {
    const value = module.effects[key];
    return value ? [`${label} ${signed(value, 2)} %`] : [];
  });
  return [moduleUsage(module), ...effects].join(" · ");
}

function editGroup(id, name, detail, contents, open) {
  return `<details class="group-edit" id="${id}" ${open ? "open" : ""}>
    <summary>${escapeText(name)} <span>${escapeText(detail)}</span></summary>
    <div class="fields">${contents}</div>
  </details>`;
}

function renderFields() {
  const open = new Set([...fieldContainer.querySelectorAll("details[open]")].map((element) => element.id));
  const firstTime = fieldContainer.dataset.view !== category;
  let content;
  if (category === "systems") {
    content = field("drive")
      + ["power", ...shieldSlots, ...coolerSlots, "radar"].map((slot) => field(slot)).join("")
      + editGroup("travel-modules", "Saut, vol et survie", "Emplacements du Hyūn", field("jump") + field("flight") + field("lifesupport"), open.has("travel-modules"));
  }
  if (category === "mining") {
    content = laserSlots.map((slot) => {
      const head = baseSlot(current, slot);
      const slots = moduleSlots(slot).slice(0, head.slots);
      const fields = field(slot, { label: "Tête de minage" }) + slots.map((id, i) =>
        field(id, { label: "Module " + (i + 1), note: moduleNote(baseSlot(current, id)) })).join("");
      return editGroup(slot, labels[slot],
        head.name.replace(" Mining Laser", "") + " · " + head.slots + " modules",
        fields, open.has(slot) || (firstTime && slot === hudTurret.value));
    }).join("");
  }
  if (category === "guns") content = gunSlots.map((slot) => field(slot)).join("");
  if (category === "salvage") {
    content = salvageSlots.map((slot, index) => editGroup(slot, index ? "Bras droit" : "Bras gauche", "Baler S2 · Abrade S1",
      field(slot) + field(scraperSlots[index]), true)).join("")
      + '<p class="panel-note">Les sous-emplacements des Baler sont verrouillés dans les données 4.10.3. Le blueprint Abrade permet de comparer les qualités de fabrication.</p>';
  }
  if (category === "cargo") {
    const capacity = format(sum(current, podSlots, "cargo"));
    content = field("paint") + editGroup("ore-pods", "Pods de minerai", `${capacity} SCU au total · 4 emplacements`,
      podSlots.map((slot) => field(slot)).join(""), open.has("ore-pods") || firstTime)
      + '<p class="panel-note">Pods interchangeables · Hyūn ou Prospector 8 SCU, MOLE 12 SCU, MISC Enhanced 15 SCU. Quatre pods de 15 SCU portent le stockage de minerai à 60 SCU.</p>';
  }
  fieldContainer.dataset.view = category;
  fieldContainer.innerHTML = content;
}

function cell(value, unit, precision) {
  return Number.isFinite(value)
    ? format(value, precision) + (unit ? ` <span class="unit">${escapeText(unit)}</span>` : "")
    : "—";
}

function compareRows(container, rows) {
  container.innerHTML = rows.map(([label, original, selection, unit, precision, direction]) => {
    const delta = Number.isFinite(original) && Number.isFinite(selection)
      ? Number((selection - original).toFixed(precision)) : 0;
    const change = delta === 0 ? "—" : signed(delta, precision);
    const color = direction && delta ? (delta * direction > 0 ? "good" : "bad") : "";
    return `<tr><th scope="row">${escapeText(label)}</th><td>${cell(original, unit, precision)}</td>
      <td>${cell(selection, unit, precision)}</td><td class="${color}">${change}</td></tr>`;
  }).join("");
}

function comparisonRow(slot, stat, rename) {
  const [label, unit, digits, direction = 1] = statLabels[stat];
  return [rename ?? label, loadoutStats(base, slot)[stat], loadoutStats(current, slot)[stat], unit, digits, direction];
}

const sum = (loadout, slots, stat) => slots.reduce((total, slot) => total + (loadoutStats(loadout, slot)[stat] ?? 0), 0);
const fuelCapacity = ARGO_DATA.fuel;

function renderPaintPreview() {
  const paint = baseSlot(current, "paint");
  const view = paintViews[paint?.id ?? "stock"];
  const preview = byId("paint-preview");
  preview.hidden = category !== "cargo" || !view;
  if (preview.hidden) return;

  const file = view;
  const name = paint?.name.replace(/^hyun\s+|\s+livery$/gi, "") ?? "Livrée d’origine";
  const photo = `hyun-${file}.webp`;
  const image = byId("paint-image");
  image.alt = paint ? `Gatac Hyūn avec la peinture ${name}` : "Gatac Hyūn dans sa livrée d’origine";
  if (image.getAttribute("src") !== photo) image.src = photo;
  byId("paint-name").textContent = name;
  byId("paint-source").href = "https://robertsspaceindustries.com/en/comm-link/transmission/21349-Gatac-Hy-n";
}

function hudLine(label, value, delta, unit, digits, preference) {
  const tone = preference && delta ? (delta * preference > 0 ? "good" : "bad") : "";
  const change = delta ? `<span class="hud-delta ${tone}">${delta > 0 ? "↑" : "↓"} ${signed(delta, digits)} ${unit}</span>` : "";
  return `<div class="hud-line"><dt>${escapeText(label)}</dt><dd>${value ? `<span>${value}</span>` : ""}${change}</dd></div>`;
}

function hudModifiers(part, effects) {
  return effects.filter((key) => part.effects[key]).map((key) => {
    const [label, preference] = miningEffects[key];
    return hudLine(label, "", part.effects[key], "%", 2, preference);
  }).join("");
}

function hudPart(name, usage, rows) {
  if (!rows) return "";
  return `<div class="hud-part"><h5>${escapeText(name)}</h5>${usage ? `<p>${escapeText(usage)}</p>` : ""}
    <dl>${rows}</dl></div>`;
}

function renderMiningHud() {
  hudPanel.hidden = category !== "mining";
  if (hudPanel.hidden) return;

  for (const button of hudPanel.querySelectorAll("[data-hud-area]")) {
    button.setAttribute("aria-pressed", String(button.dataset.hudArea === hudArea));
  }
  const { title, description, stats = [], effects } = hudAreas[hudArea];
  const slot = hudTurret.value;
  const head = baseSlot(current, slot);
  const headStats = loadoutStats(current, slot);
  const stockStats = loadoutStats(base, slot);
  const dimensions = stats.map((stat) => {
    const [label, unit, digits] = statLabels[stat];
    const delta = Number((headStats[stat] - stockStats[stat]).toFixed(digits));
    return hudLine(label, cell(headStats[stat], unit, digits), delta, unit, digits, stat === "beamMin" ? 0 : 1);
  }).join("");
  const headCard = hudPart(`Tête · ${head.name.replace(" Mining Laser", "")}`,
    current[slot].quality ? "Tête fabriquée" : "", dimensions + hudModifiers(head, effects));
  const modules = moduleSlots(slot).slice(0, head.slots).map((moduleSlot, index) => {
    const module = baseSlot(current, moduleSlot);
    return module ? hudPart(`Module ${index + 1} · ${module.name.replace(/ Module$/, "")}`,
      moduleUsage(module), hudModifiers(module, effects)) : "";
  }).join("");
  const baseline = stats.length ? '<p class="hud-reference">Écarts de la tête par rapport à l’Arbor MH1 d’origine.</p>' : "";
  const parts = headCard + modules || '<p class="hud-reference">Valeurs de référence de la roche.</p>';
  byId("hud-readout").innerHTML = `<h4>${title}</h4><p>${description}</p>${parts}${baseline}`;
}

function renderComparison() {
  renderPaintPreview();
  renderMiningHud();
  byId("salvage-guide").hidden = category !== "salvage";
  const drive = loadoutStats(current, "drive");
  const shield = { shield: sum(current, shieldSlots, "shield") };
  const currentRange = fuelCapacity / drive.burn;
  byId("metric-speed").textContent = format(drive.speed, 1);
  byId("metric-range").textContent = format(currentRange);
  byId("metric-shield").textContent = format(shield.shield);

  const profile = profileName();
  byId("selection-name").textContent = profile ? byId(profile).textContent : "Personnalisée";
  for (const name of Object.keys(profiles)) byId(name).setAttribute("aria-pressed", String(name === profile));

  let rows;
  let note;
  if (category === "systems") {
    const metrics = {
      power: [["output"], ["hp", "Intégrité de la centrale"]],
      drive: [["speed"], ["burn"], ["spool"], ["cooldown"], ["em", "Signature EM du quantique"]],
      radar: [["sensitivity"], ["assistMin"], ["assistMax"], ["hp", "Intégrité du radar"]]
    };
    rows = Object.entries(metrics).flatMap(([slot, stats]) => stats.map(([stat, label]) => comparisonRow(slot, stat, label)));
    rows.unshift(["Capacité totale des deux boucliers", sum(base, shieldSlots, "shield"), sum(current, shieldSlots, "shield"), "HP", 0, 1],
      ["Régénération totale des boucliers", sum(base, shieldSlots, "regen"), sum(current, shieldSlots, "regen"), "HP/s", 0, 1],
      ["Refroidissement total", sum(base, coolerSlots, "cooling"), sum(current, coolerSlots, "cooling"), "unités", 1, 1]);
    for (const slot of shieldSlots) {
      for (const stat of ["shield", "regen", "down", "hp", "load"]) rows.push(comparisonRow(slot, stat, labels[slot] + " · " + statLabels[stat][0].toLowerCase()));
    }
    for (const slot of coolerSlots) {
      for (const stat of ["cooling", "hp", "ir", "load"]) rows.push(comparisonRow(slot, stat, labels[slot] + " · " + statLabels[stat][0].toLowerCase()));
    }
    rows.splice(rows.findIndex((row) => row[0] === statLabels.speed[0]) + 1, 0,
      [statLabels.range[0], fuelCapacity / loadoutStats(base, "drive").burn, currentRange, "Gm", 0, 1]);
    note = `Vol subluminique du Hyūn · ${ARGO_DATA.scm} m/s en SCM, ${ARGO_DATA.nav} m/s en NAV.`;
  }
  if (category === "mining") {
    rows = [["Puissance totale des têtes", sum(base, laserSlots, "beam"), sum(current, laserSlots, "beam"), "puiss.", 1, 1]];
    for (const [i, slot] of laserSlots.entries()) {
      const name = "Bras minier";
      rows.push(comparisonRow(slot, "beam", `${name} · puissance`),
        comparisonRow(slot, "optimal", `${name} · portée optimale`),
        comparisonRow(slot, "hp", `${name} · intégrité`));
      for (const [key, title, direction] of [
        ["Resistance", "résistance de la roche", -1],
        ["OptimalChargeRate", "charge en zone optimale", 1],
        ["OptimalChargeWindow", "taille de zone optimale", 1]
      ]) {
        rows.push([`${name} · ${title}`, passiveMiningEffect(base, slot, key),
          passiveMiningEffect(current, slot, key), "%", 1, direction]);
      }
    }
    note = "Puissance des têtes hors modules. Les effets d’un module actif dépendent de son déclenchement en jeu.";
  }
  if (category === "salvage") {
    rows = scraperSlots.flatMap((slot) => ["scrapeSpeed", "scrapeRadius", "scrapeEfficiency"].map((stat) =>
      comparisonRow(slot, stat, labels[slot] + " · " + statLabels[stat][0].toLowerCase())));
    note = "Valeurs nominales des Abrade d’origine. Le coefficient de vitesse et le rayon s’interprètent ensemble. Tampon commun de 40 SCU, soute externe de 32 SCU.";
  }
  if (category === "guns") {
    rows = [["DPS brut des quatre armes", sum(base, gunSlots, "dps"), sum(current, gunSlots, "dps"), "DPS", 1, 1]];
    for (const [i, slot] of gunSlots.entries()) {
      const name = labels[slot];
      for (const [stat, label] of [["dps", "DPS"], ["alpha", "salve"], ["distance", "portée"], ["hp", "intégrité"]]) {
        rows.push(comparisonRow(slot, stat, `${name} · ${label}`));
      }
    }
    note = "Dégâts nominaux hors condensateur, recharge et résistance de la cible. Armement secondaire d’origine · 8 missiles S2 Tempest II sur le rack MSD-582.";
  }
  if (category === "cargo") {
    rows = [["Capacité totale de minerai", sum(base, podSlots, "cargo"), sum(current, podSlots, "cargo"), "SCU", 0, 1]];
    for (const slot of podSlots) rows.push(comparisonRow(slot, "cargo", labels[slot]));
    note = "Capacité des quatre pods montés. D’origine 32 SCU, avec quatre pods de MOLE 48 SCU, avec quatre MISC Enhanced 60 SCU. Le blueprint du pod renforcé demande du fer de qualité 800 minimum. Soute cargo séparée de 32 SCU et tampon de salvage de 40 SCU.";
  }
  compareRows(byId("comparison"), rows);
  byId("comparison-note").textContent = note;
  byId("comparison-note").hidden = false;
}

function setPointOptions(side, preferredId) {
  const system = byId(side + "-system").value;
  const [from, to] = defaultPoints[system];
  const preferredName = side === "from" ? from : to;
  const points = Object.entries(ARGO_DATA.points).filter(([, point]) => point.system === system)
    .sort((a, b) => a[1].name.localeCompare(b[1].name, "fr", { numeric: true }));
  const selector = byId(side + "-point");
  selector.replaceChildren(...points.map(([id, point]) => new Option(point.name, id)));
  const fallback = points.find(([, point]) => point.name === preferredName) ?? points[0];
  selector.value = preferredId && points.some(([id]) => id === preferredId) ? preferredId : fallback[0];
}

function renderRoute() {
  const from = ARGO_DATA.points[byId("from-point").value];
  const to = ARGO_DATA.points[byId("to-point").value];
  const distanceInput = byId("distance");
  const inputValid = distanceInput.validity.valid && distanceInput.value !== "";
  const showMap = routeMode === "map";
  const distinct = from !== to;
  const legs = showMap ? (distinct ? routeLegs(from, to) : []) : (inputValid ? [{ distance: distanceInput.valueAsNumber }] : []);
  const roundTrip = byId("round-trip").checked;
  const display = legs.length > 0;
  const stock = display && routeTotals(legs, roundTrip, base);
  const active = display && routeTotals(legs, roundTrip, current);
  compareRows(byId("route-comparison"), [
    ["Distance quantique", stock?.distance, active?.distance, "Gm", 3, 0],
    ["Temps quantique estimé", stock?.seconds, active?.seconds, "s", 0, -1],
    ["Carburant quantique estimé", stock?.fuel, active?.fuel, "SCU", 3, -1]
  ]);
  byId("legs").innerHTML = showMap ? legs.map(({ from: start, to: end, distance }) => distance === null
    ? `<li class="gate-leg">Porte ${systemNames[start.system]} → ${systemNames[end.system]}</li>`
    : `<li>${escapeText(start.name)} → ${escapeText(end.name)} · ${format(distance, 4)} Gm</li>`).join("") : "";
  let warning = "";
  if (!display) warning = showMap ? "Sélectionne deux points différents." : "Saisis une distance entre 0,000001 et 2 000 Gm.";
  else if (active.oneWayFuel > fuelCapacity) warning = "Carburant insuffisant à l’aller. Prévois un ravitaillement.";
  else if (active.fuel > fuelCapacity) warning = "Le plein couvre l’aller. Prévois un ravitaillement avant le retour.";
  byId("route-status").textContent = warning;
  byId("route-status").hidden = !warning;
}

const craft = byId("craft");
const craftForm = byId("craft-form");
const recipeInputs = () => [...craftForm.querySelectorAll(".recipe-quality")];
const craftQualities = () => recipeInputs().map((input) => input.valueAsNumber);

function renderCraftPreview() {
  const item = baseSlot(current, craftSlot);
  const qualities = craftQualities();
  const valid = validQualities(item.recipe, qualities);
  for (const input of recipeInputs()) byId(input.id.replace("ingredient-", "ingredient-effect-")).textContent = "";
  byId("equip-crafted").disabled = !valid;
  if (!valid) {
    byId("craft-results").innerHTML = "<p class='panel-note'>Respecte la qualité minimale de chaque matériau et saisis une valeur entière jusqu’à 1 000.</p>";
    return;
  }

  const impacts = [];
  for (const [i, ingredient] of item.recipe.ingredients.entries()) {
    const values = ingredient.modifiers.map(([key, additive, segments]) => {
      const change = evaluateCurve(segments, qualities[i]);
      const amount = additive ? change : (change - 1) * 100;
      const label = key === "weapon_damage" ? (slotGroup(craftSlot) === "laser" ? "Puissance du laser" : "Dégâts") : modifierLabels[key];
      return label + " " + signed(amount, 2) + (additive ? " unités" : " %");
    });
    const hint = byId("ingredient-effect-" + i);
    hint.textContent = values.join(" · ");
    if (values.length) impacts.push(...ingredient.modifiers.map(([key]) => key));
  }
  if (!impacts.length) {
    byId("craft-results").innerHTML = "<p class='panel-note'>Ce plan indique une recette, sans bonus de qualité chiffré.</p>";
    return;
  }
  const crafted = effectiveStats(item, qualities);
  const stats = [...new Set(impacts.flatMap((key) => modifierStats[key]))].filter((key) => Number.isFinite(item.stats[key]));
  byId("craft-results").innerHTML = `<div class="craft-preview"><table>
    <caption class="sr-only">Effet de la fabrication pour cette pièce</caption>
    <thead><tr><th scope="col">Statistique</th><th scope="col">Standard</th><th scope="col">Fabriquée</th><th scope="col">Écart</th></tr></thead>
    <tbody id="craft-delta"></tbody></table></div>`;
  compareRows(byId("craft-delta"), stats.map((stat) => {
    const [name, unit, digits, direction = 1] = statLabels[stat];
    return [name, item.stats[stat], crafted[stat], unit, digits, direction];
  }));
}

function showCraft(slot) {
  craftSlot = slot;
  const item = baseSlot(current, slot);
  const recipe = item.recipe;
  const availability = {
    default: "Plan disponible par défaut.",
    reward: "Source du plan répertoriée.",
    unknown: "Recette répertoriée. Obtention du plan à vérifier en jeu."
  };
  byId("craft-title").textContent = item.name;
  const minutes = Math.floor(recipe.seconds / 60);
  const seconds = recipe.seconds % 60;
  byId("craft-note").textContent = labels[slot] + " · Fabrication " + (minutes ? minutes + " min " : "") + (seconds ? seconds + " s" : "") + " · " + availability[recipe.unlock];
  byId("craft-source").href = "https://scuplift.com/en/blueprints/" + encodeURIComponent(recipe.id);
  byId("standard-item").hidden = current[slot].quality === null;
  byId("equip-crafted").hidden = slotGroup(slot) === "scraper";
  if (slotGroup(slot) === "scraper") byId("craft-note").textContent += " · Comparaison de fabrication pour le sous-emplacement verrouillé.";
  for (const button of craftForm.querySelectorAll("[data-quality]")) {
    button.disabled = recipe.ingredients.some(({ min }) => Number(button.dataset.quality) < min);
  }
  byId("ingredients").innerHTML = recipe.ingredients.map((ingredient, i) => {
    const value = current[slot].quality?.[i] ?? Math.max(500, ingredient.min);
    const name = materialLabels[ingredient.material] ?? ingredient.material;
    const amount = format(ingredient.quantity, 3) + (ingredient.scu ? " SCU" : " unités");
    return `<div class="recipe-row">
      <label for="ingredient-${i}"><strong>${escapeText(name)}</strong> · ${amount}
        <span>${escapeText(ingredient.part)} · Min. ${ingredient.min}</span>
        <span id="ingredient-effect-${i}"></span>
      </label>
      <input class="recipe-quality" type="number" inputmode="numeric" id="ingredient-${i}" min="${ingredient.min}" max="1000" value="${value}" step="1" required>
    </div>`;
  }).join("");
  renderCraftPreview();
  craft.showModal();
}

function commitLoadout(announcement, focusSelector, updatedSlot) {
  const turret = laserSlots.find((slot) => slot === updatedSlot || moduleSlots(slot).includes(updatedSlot));
  if (turret) hudTurret.value = turret;
  saveLoadout();
  renderFields();
  renderComparison();
  renderRoute();
  byId("live-update").textContent = announcement;
  if (focusSelector) fieldContainer.querySelector(focusSelector)?.focus({ preventScroll: true });
}

for (const id of Object.keys(profiles)) {
  byId(id).addEventListener("click", () => {
    current = defaultLoadout(id);
    commitLoadout("Configuration " + byId(id).textContent.toLowerCase() + " chargée.");
  });
}
for (const button of document.querySelectorAll("[data-category]")) {
  button.addEventListener("click", () => {
    category = button.dataset.category;
    for (const peer of document.querySelectorAll("[data-category]")) {
      peer.setAttribute("aria-pressed", String(peer === button));
    }
    renderFields();
    renderComparison();
  });
}
fieldContainer.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-slot]");
  if (!select) return;
  const slot = select.dataset.slot;
  current[slot] = { id: select.value || null, quality: null };
  if (slotGroup(slot) === "laser") {
    for (const module of moduleSlots(slot).slice(baseSlot(current, slot).slots)) {
      current[module] = { id: null, quality: null };
    }
  }
  commitLoadout(labels[slot] + " mis à jour.", "#slot-" + slot, slot);
});
fieldContainer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-craft]");
  if (button) showCraft(button.dataset.craft);
  const summary = event.target.closest("summary");
  if (category === "mining" && summary && !summary.parentElement.open) {
    hudTurret.value = summary.parentElement.id;
    renderMiningHud();
  }
});
hudPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hud-area]");
  if (!button) return;
  hudArea = button.dataset.hudArea;
  renderMiningHud();
});
hudTurret.addEventListener("change", () => {
  byId(hudTurret.value).open = true;
  renderMiningHud();
});

byId("close-craft").addEventListener("click", () => craft.close());
byId("standard-item").addEventListener("click", () => {
  current[craftSlot].quality = null;
  craft.close();
  commitLoadout("Pièce standard montée.", `[data-craft="${craftSlot}"]`, craftSlot);
});
craftForm.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quality]");
  if (!button) return;
  for (const input of recipeInputs()) input.value = button.dataset.quality;
  renderCraftPreview();
});
craftForm.addEventListener("input", renderCraftPreview);
craftForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (slotGroup(craftSlot) === "scraper") return;
  const qualities = craftQualities();
  const item = baseSlot(current, craftSlot);
  if (!validQualities(item.recipe, qualities)) return;
  current[craftSlot].quality = qualities;
  craft.close();
  commitLoadout(item.name + " fabriqué et monté.", `[data-craft="${craftSlot}"]`, craftSlot);
});

for (const side of ["from", "to"]) {
  byId(side + "-system").addEventListener("change", () => {
    setPointOptions(side);
    renderRoute();
  });
  byId(side + "-point").addEventListener("change", renderRoute);
  setPointOptions(side);
}
byId("swap").addEventListener("click", () => {
  const fromSystem = byId("from-system").value;
  const fromPoint = byId("from-point").value;
  const toPoint = byId("to-point").value;
  byId("from-system").value = byId("to-system").value;
  byId("to-system").value = fromSystem;
  setPointOptions("from", toPoint);
  setPointOptions("to", fromPoint);
  renderRoute();
});
for (const button of document.querySelectorAll("[data-route-mode]")) {
  button.addEventListener("click", () => {
    routeMode = button.dataset.routeMode;
    for (const peer of document.querySelectorAll("[data-route-mode]")) {
      peer.setAttribute("aria-pressed", String(peer === button));
    }
    byId("route-map").hidden = routeMode !== "map";
    byId("route-manual").hidden = routeMode !== "manual";
    renderRoute();
  });
}
byId("distance").addEventListener("input", renderRoute);
byId("round-trip").addEventListener("change", renderRoute);
byId("paint-zoom").addEventListener("click", () => {
  const preview = byId("paint-image");
  const fullImage = byId("paint-full-image");
  fullImage.src = preview.src;
  fullImage.alt = preview.alt;
  byId("paint-dialog-title").textContent = byId("paint-name").textContent;
  byId("paint-dialog").showModal();
});
document.querySelector(".hero-image img").addEventListener("error", (event) => {
  event.currentTarget.hidden = true;
});
renderFields();
renderComparison();
renderRoute();

SavedConfigurations.mount({
  container: byId("configurations"),
  getShip: () => ({ id: "hyun", name: "Gatac Hyūn" }),
  getState: () => current,
  normalize: restoreLoadout,
  apply: (loadout) => {
    current = restoreLoadout(loadout);
    commitLoadout("Configuration enregistrée chargée.");
  }
});

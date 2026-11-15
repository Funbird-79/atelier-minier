"use strict";

const byId = (id) => document.getElementById(id);
const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => escapes[character]);
const formats = Array.from({ length: 7 }, (_, maximumFractionDigits) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits }));
const format = (value, precision = 0) => formats[precision].format(value);
const signed = (value, precision = 0) => (value >= 0 ? "+" : "−") + format(Math.abs(value), precision);
const fieldContainer = byId("fields");
const base = defaultLoadout("stock");
const storageKey = "atelier-minier-mole-loadout-v1";
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
  beam: ["Puissance nominale du laser", "puiss.", 1],
  beamMin: ["Puissance minimale du laser", "puiss.", 1],
  optimal: ["Portée optimale", "m", 0],
  distance: ["Portée maximale", "m", 0],
  extraction: ["Débit nominal d’extraction", "unités", 0],
  dps: ["Dégâts bruts par seconde", "DPS", 1],
  alpha: ["Dégâts par salve", "HP", 1],
  cargo: ["Capacité de minerai", "SCU", 0]
};
const classLabels = { Civilian: "civil", Industrial: "industriel", Military: "militaire", Stealth: "furtif", Competition: "compétition" };
const paintViews = {
  stock: ["stock", "Mole_in_Space_-_Isometric.jpg"],
  paint_mole_aphorite_purple: ["aphorite", "MOLE_Aphorite_-_Landed.jpg"],
  paint_mole_black_vip: ["carbon", "MOLE_Carbon_-_Flying_front_starboard_-_cropped_and_adjusted.jpg"],
  paint_mole_dolivine_green: ["dolivine", "MOLE_Dolivine_-_Landed.jpg"],
  paint_mole_yellow_grey_black: ["greycat", "Argo_MOLE_Greycat_isometric.jpg"],
  paint_mole_hadanite_pink: ["hadanite", "MOLE_Hadinite_-_Landed.jpg"],
  paint_mole_workersweek_white_blue_blue: ["keystone", "MOLE_Keystone_landed_in_hangar_-_cropped.png"],
  paint_mole_lovestruck_pink_black: ["lovestruck", "Mole_Lovestruck_landed_in_hangar.png"],
  paint_mole_yellow_black_blue: ["pyrotechnic", "Argo_MOLE_Pyrotechnic_Isometric.jpg"],
  paint_mole_bronze_black_brown: ["shubin", "Argo_MOLE_Shubin_Isometric.jpg"],
  paint_mole_grey: ["talus", "MOLE_Talus_-_Flying_front_starboard_-_cropped_and_adjusted.jpg"]
};
const modifierLabels = {
  health_maxhealth: "Intégrité", quantum_speed: "Vitesse quantique",
  quantum_fuelrequirement: "Consommation quantique", shield_maxhealth: "Capacité du bouclier",
  itemresource_powergeneration: "Puissance", itemresource_coolantgeneration: "Refroidissement",
  radar_minaimassistdistance: "Aide à la visée (min.)", radar_maxaimassistdistance: "Aide à la visée (max.)",
  weapon_damage: "Puissance du laser ou dégâts"
};
const materialLabels = { Iron: "Fer", Copper: "Cuivre", Tungsten: "Tungstène", Titanium: "Titane", Aluminum: "Aluminium", "Pressurized Ice": "Glace sous pression", Silver: "Argent", Gold: "Or", Diamond: "Diamant" };
const miningLabels = {
  OptimalChargeRate: "Charge en zone optimale", OptimalChargeWindow: "Taille de la zone optimale",
  AllChargeRates: "Vitesses de charge", Resistance: "Résistance de la roche",
  Instability: "Instabilité", InertMaterials: "Matières inertes",
  OverchargeRate: "Surcharge", ShatterDamage: "Dégâts de fragmentation",
  DamageMultiplierChange: "Puissance du laser"
};

let current;
try { current = restoreLoadout(JSON.parse(localStorage.getItem(storageKey))); }
catch { current = defaultLoadout("balanced"); }
let category = "systems";
let routeMode = "map";
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

function moduleNote(module) {
  if (!module) return "";
  const pieces = [module.active ? `Actif · ${module.charges} utilisations de ${module.seconds} s` : "Passif"];
  for (const [key, value] of Object.entries(module.effects)) {
    if (miningLabels[key]) pieces.push(miningLabels[key] + " " + signed(key === "DamageMultiplierChange" ? value * 100 : value, 1) + " %");
  }
  return pieces.join(" · ");
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
      + ["shield", "power", "cooler", "radar"].map((slot) => field(slot)).join("")
      + editGroup("travel-modules", "Saut et vol", "Emplacements S2 et S1", field("jump") + field("flight"), open.has("travel-modules"));
  }
  if (category === "mining") {
    content = laserSlots.map((slot, index) => {
      const head = baseSlot(current, slot);
      const slots = moduleSlots(slot).slice(0, head.slots);
      const fields = field(slot, { label: "Tête de minage" }) + slots.map((id, i) =>
        field(id, { label: "Module " + (i + 1), note: moduleNote(baseSlot(current, id)) })).join("");
      return editGroup(slot, labels[slot],
        head.name.replace(" Mining Laser", "") + " · " + head.slots + " modules",
        fields, open.has(slot) || (firstTime && index === 0));
    }).join("");
  }
  if (category === "guns") content = gunSlots.map((slot) => field(slot)).join("");
  if (category === "cargo") {
    content = field("paint") + editGroup("ore-pods", "Pods de minerai", "8 emplacements",
      podSlots.map((slot) => field(slot)).join(""), open.has("ore-pods"));
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

  const [file, source] = view;
  const name = paint?.name.replace(/^mole\s+|\s+livery$/gi, "") ?? "Livrée d’origine";
  const photo = `assets/paints/${file}.webp`;
  const image = byId("paint-image");
  image.alt = paint ? `ARGO MOLE avec la peinture ${name}` : "ARGO MOLE dans sa livrée orange d’origine";
  if (image.getAttribute("src") !== photo) image.src = photo;
  byId("paint-name").textContent = name;
  byId("paint-source").href = `https://starcitizen.tools/File:${source}`;
}

function renderComparison() {
  renderPaintPreview();
  const drive = loadoutStats(current, "drive");
  const shield = loadoutStats(current, "shield");
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
      cooler: [["cooling"], ["ir", "Signature IR du refroidisseur"], ["hp", "Intégrité du refroidisseur"]],
      shield: [["shield"], ["regen"], ["down"], ["load", "Demande du bouclier"], ["hp", "Intégrité du générateur de bouclier"]],
      drive: [["speed"], ["burn"], ["spool"], ["cooldown"], ["em", "Signature EM du quantique"], ["hp", "Intégrité du quantique"]],
      radar: [["sensitivity"], ["assistMin"], ["assistMax"], ["hp", "Intégrité du radar"]]
    };
    rows = Object.entries(metrics).flatMap(([slot, stats]) => stats.map(([stat, label]) => comparisonRow(slot, stat, label)));
    rows.splice(rows.findIndex((row) => row[0] === statLabels.speed[0]) + 1, 0,
      [statLabels.range[0], fuelCapacity / loadoutStats(base, "drive").burn, currentRange, "Gm", 0, 1]);
    note = `Vol subluminique du MOLE classique · ${ARGO_DATA.scm} m/s en SCM, ${ARGO_DATA.nav} m/s en NAV.`;
  }
  if (category === "mining") {
    rows = [["Puissance totale des têtes", sum(base, laserSlots, "beam"), sum(current, laserSlots, "beam"), "puiss.", 1, 1]];
    for (const [i, slot] of laserSlots.entries()) {
      const name = ["Centre", "Gauche", "Droite"][i];
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
  if (category === "guns") {
    rows = [["DPS brut des deux armes", sum(base, gunSlots, "dps"), sum(current, gunSlots, "dps"), "DPS", 1, 1]];
    for (const [i, slot] of gunSlots.entries()) {
      const name = i ? "Droite" : "Gauche";
      for (const [stat, label] of [["dps", "DPS"], ["alpha", "salve"], ["distance", "portée"], ["hp", "intégrité"]]) {
        rows.push(comparisonRow(slot, stat, `${name} · ${label}`));
      }
    }
    note = "Dégâts nominaux hors limitation du condensateur, recharge et résistance de la cible.";
  }
  if (category === "cargo") {
    rows = [["Capacité totale de minerai", sum(base, podSlots, "cargo"), sum(current, podSlots, "cargo"), "SCU", 0, 1]];
    for (const slot of podSlots) rows.push(comparisonRow(slot, "cargo", labels[slot]));
    note = "Capacité des huit pods installés.";
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

function commitLoadout(announcement, focusSelector) {
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
  commitLoadout(labels[slot] + " mis à jour.", "#slot-" + slot);
});
fieldContainer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-craft]");
  if (button) showCraft(button.dataset.craft);
});

byId("close-craft").addEventListener("click", () => craft.close());
byId("standard-item").addEventListener("click", () => {
  current[craftSlot].quality = null;
  craft.close();
  commitLoadout("Pièce standard montée.", `[data-craft="${craftSlot}"]`);
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
  const qualities = craftQualities();
  const item = baseSlot(current, craftSlot);
  if (!validQualities(item.recipe, qualities)) return;
  current[craftSlot].quality = qualities;
  craft.close();
  commitLoadout(item.name + " fabriqué et monté.", `[data-craft="${craftSlot}"]`);
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

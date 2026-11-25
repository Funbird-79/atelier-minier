"use strict";

const F = FleetModel;
const el = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const numberFormats = Array.from({ length: 7 }, (_, maximumFractionDigits) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits }));
const fmt = (value, digits = 0) => Number.isFinite(value) ? numberFormats[digits].format(value) : "—";
const signed = (value, digits = 0) => (value > 0 ? "+" : value < 0 ? "−" : "") + fmt(Math.abs(value), digits);
const groupNames = { drive: "Moteur quantique", power: "Centrale électrique", shield: "Bouclier", cooler: "Refroidisseur", radar: "Radar", jump: "Module de saut", lifesupport: "Support de vie", flight: "Contrôleur de vol", gun: "Arme", missile: "Missile", rack: "Lance-missiles", defensive: "Contre-mesures", laser: "Tête de minage", module: "Module de minage", salvage: "Tête de salvage", scraper: "Module de salvage", pod: "Pod de minerai", tractor: "Rayon tracteur" };
const classNames = { Industrial: "industriel", Military: "militaire", Civilian: "civil", Stealth: "furtif", Competition: "compétition" };
const statLabels = {
  hp: ["Intégrité de la pièce", "HP", 0, 1], load: ["Consommation électrique", "unités", 1, -1],
  em: ["Signature EM", "", 0, -1], ir: ["Signature IR", "", 0, -1],
  speed: ["Pointe quantique", "Mm/s", 1, 1], burn: ["Consommation quantique", "SCU/Gm", 6, -1],
  spool: ["Mise en route", "s", 1, -1], cooldown: ["Délai entre sauts", "s", 1, -1],
  shield: ["Capacité du bouclier", "HP", 0, 1], regen: ["Régénération du bouclier", "HP/s", 0, 1],
  down: ["Délai après rupture", "s", 1, -1], damageDelay: ["Délai après impact", "s", 1, -1],
  output: ["Puissance de la centrale", "unités", 0, 1], cooling: ["Débit du refroidisseur", "unités", 1, 1],
  sensitivity: ["Sensibilité radar aux roches (RS)", "%", 0, 1], assistMin: ["Aide à la visée · min.", "m", 0, 1],
  assistMax: ["Aide à la visée · max.", "m", 0, 1], beam: ["Puissance de fracture max.", "unités", 0, 1],
  beamMin: ["Puissance de fracture min.", "unités", 0, 1], optimal: ["Portée optimale", "m", 0, 1],
  distance: ["Portée maximale", "m", 0, 1], extraction: ["Puissance d’extraction", "unités", 0, 1],
  cargo: ["Capacité de minerai", "SCU", 0, 1], dps: ["Dégâts bruts par seconde", "DPS", 1, 1],
  alpha: ["Dégâts par salve", "HP", 1, 1], scrapeSpeed: ["Coefficient de vitesse du décapage", "×", 2, 1],
  scrapeRadius: ["Coefficient de rayon du décapage", "×", 2, 1], scrapeEfficiency: ["Efficacité de récupération", "%", 1, 1]
};
const effectLabels = {
  FracturePower: ["Puissance de fracture", 1], Resistance: ["Résistance de la roche", -1],
  Instability: ["Instabilité", -1], OptimalChargeWindow: ["Largeur de la zone verte", 1],
  OptimalChargeRate: ["Progression de la fracture", 1], OverchargeRate: ["Vitesse de surcharge", -1],
  ShatterDamage: ["Dégâts de fragmentation", -1], ExtractionPower: ["Puissance d’extraction", 1],
  InertMaterials: ["Matières inertes collectées", -1]
};
const materialNames = { Iron: "Fer", Copper: "Cuivre", Titanium: "Titane", Tungsten: "Tungstène", Aluminum: "Aluminium", Gold: "Or", Silver: "Argent", Diamond: "Diamant", "Pressurized Ice": "Glace sous pression" };
const storageKey = id => "atelier-minier-flotte-" + id + "-v1";
let ship, current, base, craftSlot;
let category = "composition";
let profileHint = "balanced";
let configurationSaves;
let savedOk = true;

function partName(part) {
  if (!part) return "Emplacement vide";
  if (Number.isFinite(part.stats.cargo)) return part.name + " · " + fmt(part.stats.cargo) + " SCU";
  return part.name + (part.kind ? " · " + (classNames[part.kind] ?? part.kind) + " " + (part.grade === "Bespoke" ? "dédié" : part.grade) : "");
}
const slotEnabled = slot => slot.group !== "module" || slot.moduleIndex < (F.item(current, slot.parent)?.slots ?? 0);
function save() {
  try { localStorage.setItem(storageKey(ship.id), JSON.stringify(current)); savedOk = true; }
  catch { savedOk = false; }
  el("save-state").textContent = savedOk ? "Dernier montage conservé automatiquement sur cet appareil." : "Sauvegarde locale indisponible. La configuration reste utilisable dans cette page.";
}
function selectShip(id) {
  if (id === "mole" || id === "hyun") { location.href = id === "mole" ? "index.html" : "hyun.html"; return; }
  ship = FLEET_DATA.ships.find(candidate => candidate.id === id) ?? FLEET_DATA.ships[0];
  el("ship-picker").value = ship.id;
  try { current = F.restore(ship, JSON.parse(localStorage.getItem(storageKey(ship.id)))); }
  catch { current = F.defaults(ship); }
  base = F.defaults(ship, "stock");
  category = "composition";
  profileHint = "balanced";
  const url = new URL(location.href);
  url.searchParams.set("vaisseau", ship.id);
  history.replaceState(null, "", url);
  document.title = "Atelier minier · " + ship.name;
  const split = ship.name.lastIndexOf(" ");
  el("ship-title").innerHTML = escapeHtml(ship.name.slice(0, split)) + " <span>" + escapeHtml(ship.name.slice(split + 1)) + "</span>";
  el("ship-role").textContent = ship.role;
  el("ship-summary").textContent = ship.crew + (ship.crew === 1 ? " place d’équipage" : " places d’équipage") + " · Nyx · Stanton · Pyro";
  el("ship-image").src = ship.image;
  el("ship-image").alt = ship.name + " dans sa livrée d’origine";
  el("image-source").href = ship.imageSource;
  el("ship-source").href = ship.source;
  el("result-title").textContent = "Effets sur le " + ship.name;
  el("ship-notes").textContent = ship.notes.join(" ");
  el("save-state").textContent = "Le dernier montage est repris automatiquement. Utilise « Mes configurations » pour garder plusieurs profils.";
  const changed = ship.slots.filter(slot => ship.balanced[slot.id] !== slot.stock).map(slot => FLEET_DATA.parts[ship.balanced[slot.id]]?.name).filter(Boolean);
  el("recommendation").textContent = changed.length
    ? "Préréglage équilibré : " + [...new Set(changed)].join(", ") + ". Il conserve les pods et les équipements de salvage d’origine."
    : "Préréglage équilibré : équipement d’origine conservé. Les pièces dédiées peuvent être comparées à leur version fabriquée lorsqu’un blueprint existe.";
  for (const button of document.querySelectorAll("[data-category]")) {
    button.hidden = button.dataset.category !== "composition" && !ship.slots.some(slot => slot.category === button.dataset.category)
      && !(button.dataset.category === "cargo" && ship.cargo > 0);
  }
  render();
  configurationSaves?.syncShip();
}

function field(slot) {
  const selected = F.item(current, slot.id);
  const crafted = current[slot.id].quality !== null;
  const options = (slot.stock === null ? '<option value="">Emplacement vide</option>' : "") + slot.choices.map(id =>
    `<option value="${id}" ${id === selected?.id ? "selected" : ""}>${escapeHtml(partName(FLEET_DATA.parts[id]))}</option>`).join("");
  const fixed = !slot.editable;
  const button = selected?.recipe ? `<button class="secondary ${crafted ? "crafted" : ""}" type="button" data-craft="${slot.id}" aria-label="Blueprint de ${escapeHtml(selected.name)} (${escapeHtml(slot.label)})">${crafted ? "Fabriquée" : "Blueprint"}</button>` : "";
  let note = fixed ? "Équipement intégré · montage d’origine conservé." : "";
  if (slot.group === "module" && selected) note = (selected.active ? `Actif · ${selected.charges} utilisations de ${selected.seconds} s. ` : "Passif. ")
    + Object.entries(effectLabels).filter(([key]) => selected.effects[key]).map(([key, [label]]) => label + " " + signed(selected.effects[key], 1) + " %").join(" · ");
  if (slot.group === "pod" && selected?.recipe?.ingredients.some(ingredient => ingredient.min >= 800)) note = "Blueprint : qualité minimale 800 pour le fer. La qualité ne multiplie pas la capacité du pod.";
  if (slot.group === "scraper" && slot.editable) note = selected.salvageMode === "tractor"
    ? "Rayon tracteur pour manipuler les épaves · aucun décapage RMC."
    : "Module de décapage interchangeable · blueprint et qualité pris en compte.";
  return `<div class="field"><label for="slot-${slot.id}">${escapeHtml(slot.label)} <span>S${slot.size}${fixed ? " · intégré" : ""}</span></label><div class="field-control"><select id="slot-${slot.id}" data-slot="${slot.id}" ${fixed || slot.choices.length === 1 && slot.stock !== null ? "disabled" : ""}>${options}</select>${button}</div>${note ? `<small>${escapeHtml(note)}</small>` : ""}</div>`;
}
function renderFields() {
  const container = el("fields");
  const opened = new Set([...container.querySelectorAll("details[open]")].map(node => node.dataset.group));
  const changed = container.dataset.view !== ship.id + ":" + category;
  container.dataset.view = ship.id + ":" + category;
  if (category === "composition") {
    container.innerHTML = `<div class="composition-intro"><p>Le tableau compare toute la composition d’origine à ta configuration actuelle.</p><ul><li>Systèmes : quantique, boucliers, centrales, refroidissement et radar.</li><li>${ship.ore ? "Minage : tête, modules et pods compatibles." : "Salvage : têtes, modules compatibles et capacités de traitement."}</li><li>Armes : canons, missiles et contre-mesures du vaisseau.</li><li>Blueprint : recettes, qualité par matériau et gains calculés.</li></ul><p>Choisis une catégorie pour modifier les composants. Les pièces intégrées restent visibles.</p></div>`;
    return;
  }
  const slots = ship.slots.filter(slot => slot.category === category && slotEnabled(slot));
  if (!slots.length) { container.innerHTML = '<p class="panel-note">La soute cargo est fixe : ' + fmt(ship.cargo) + ' SCU. Le tampon de salvage est affiché séparément.</p>'; return; }
  if (category === "mining" || category === "cargo") { container.innerHTML = slots.map(field).join(""); return; }
  if (category === "salvage") {
    const heads = slots.filter(slot => slot.group === "salvage");
    const grouped = new Set();
    container.innerHTML = heads.map(head => {
      const modules = slots.filter(slot => slot.group === "scraper" && slot.parent === head.id);
      [head, ...modules].forEach(slot => grouped.add(slot.id));
      const detail = modules.length + " module" + (modules.length > 1 ? "s indépendants" : " dédié");
      return `<details class="group-edit" data-group="${head.id}" ${changed || opened.has(head.id) ? "open" : ""}><summary>${escapeHtml(head.label)}<span>${detail}</span></summary><div class="fields">${[head, ...modules].map(field).join("")}</div></details>`;
    }).join("") + slots.filter(slot => !grouped.has(slot.id)).map(field).join("");
    return;
  }
  const groups = [...new Set(slots.map(slot => slot.group))];
  container.innerHTML = groups.map(group => {
    const members = slots.filter(slot => slot.group === group);
    return `<details class="group-edit" data-group="${group}" ${changed || opened.has(group) ? "open" : ""}><summary>${escapeHtml(groupNames[group])}<span>${members.length} emplacement${members.length > 1 ? "s" : ""}</span></summary><div class="fields">${members.map(field).join("")}</div></details>`;
  }).join("");
}
function tableRow(label, first, second, unit = "", digits = 0, direction = 1) {
  const comparable = Number.isFinite(first) && Number.isFinite(second);
  const difference = comparable ? second - first : 0;
  const tone = !comparable || Math.abs(difference) < 1e-9 ? "" : difference * direction > 0 ? "good" : "bad";
  return `<tr><th scope="row">${escapeHtml(label)}</th><td>${fmt(first, digits)} <span class="unit">${Number.isFinite(first) ? escapeHtml(unit) : ""}</span></td><td>${fmt(second, digits)} <span class="unit">${Number.isFinite(second) ? escapeHtml(unit) : ""}</span></td><td class="${tone}">${!comparable || Math.abs(difference) < 1e-9 ? "—" : signed(difference, digits)}</td></tr>`;
}
function statRow(slot, key) {
  const [label, unit, digits, direction] = statLabels[key];
  return tableRow(slot.label + " · " + label.toLowerCase(), F.stats(base, slot.id)[key] ?? 0, F.stats(current, slot.id)[key] ?? 0, unit, digits, direction);
}
function compositionRows() {
  const grouped = new Map();
  for (const slot of ship.slots.filter(slotEnabled)) {
    if (slot.stock === null && current[slot.id].id === null) continue;
    const record = current[slot.id];
    const key = JSON.stringify([slot.group, slot.size, slot.stock, record.id, record.quality, slot.editable]);
    const group = grouped.get(key) ?? { slot, count: 0 };
    group.count++;
    grouped.set(key, group);
  }
  return [...grouped.values()].map(({ slot, count }) => {
    const original = FLEET_DATA.parts[slot.stock];
    const selected = F.item(current, slot.id);
    const qualities = current[slot.id].quality;
    const quality = qualities ? `<span class="part-quality">Fabriquée · Q${fmt(qualities.reduce((total, q) => total + q, 0) / qualities.length)}</span>` : "";
    return `<tr><th scope="row">${escapeHtml(groupNames[slot.group])}<small>S${slot.size}${slot.editable ? "" : " · intégré"}</small></th><td class="component">${original ? count + " × " + escapeHtml(original.name) : "Vide"}</td><td class="component">${selected ? count + " × " + escapeHtml(selected.name) : "Vide"}${quality}</td><td>${original?.id === selected?.id && !qualities ? "—" : "Modifiée"}</td></tr>`;
  }).join("");
}
function renderComparison() {
  el("comparison-label").textContent = category === "composition" ? "Élément" : "Indicateur";
  el("comparison-caption").textContent = ship.name + " · configuration comparée au montage d’origine";
  let rows = [], note = "";
  if (category === "composition") {
    el("comparison").innerHTML = compositionRows();
    el("comparison-note").textContent = "Chaque quantité correspond à un équipement réellement monté. Les emplacements intégrés et les tailles sont conservés. Les modules de minage sans emplacement disponible sont masqués.";
    return;
  }
  if (category === "systems") {
    for (const [label, group, stat, unit, digits] of [
      ["Capacité totale des boucliers", "shield", "shield", "HP", 0], ["Régénération totale des boucliers", "shield", "regen", "HP/s", 0],
      ["Puissance totale des centrales", "power", "output", "unités", 0], ["Refroidissement total", "cooler", "cooling", "unités", 1]
    ]) rows.push(tableRow(label, F.sum(ship, base, group, stat), F.sum(ship, current, group, stat), unit, digits));
    const metrics = { drive: ["speed", "burn", "spool", "cooldown"], power: ["output", "hp"], shield: ["shield", "regen", "down"], cooler: ["cooling", "hp"], radar: ["sensitivity", "assistMin", "assistMax", "hp"] };
    for (const slot of ship.slots.filter(slot => slot.category === category)) for (const key of metrics[slot.group] ?? []) rows.push(statRow(slot, key));
    note = `Vol subluminique : ${fmt(ship.scm)} m/s en SCM, ${fmt(ship.nav)} m/s en NAV. Ces vitesses ne sont pas multipliées par les gains du moteur quantique.`;
  }
  if (category === "mining") {
    for (const slot of F.slotsOf(ship, "laser")) {
      const first = F.mining(ship, base, slot.id, el("active-modules").checked);
      const second = F.mining(ship, current, slot.id, el("active-modules").checked);
      for (const key of ["beam", "beamMin", "optimal", "distance", "extraction"]) {
        const [label, unit, digits, direction] = statLabels[key];
        rows.push(tableRow(label, first.stats[key], second.stats[key], unit, digits, direction));
      }
      for (const [key, [label, direction]] of Object.entries(effectLabels)) rows.push(tableRow(label + " · modificateur", first.effects[key] ?? 0, second.effects[key] ?? 0, "%", 1, direction));
    }
    note = "Tête et modules passifs cumulés. Les actifs sont inclus seulement quand la case correspondante est cochée. L’écart entre deux modificateurs est donné en points de pourcentage. La roche, sa masse et les autres faisceaux influencent le résultat en jeu.";
  }
  if (category === "salvage") {
    for (const slot of F.slotsOf(ship, "scraper")) {
      const first = F.stats(base, slot.id), second = F.stats(current, slot.id);
      if (!Number.isFinite(first.scrapeSpeed) && !Number.isFinite(second.scrapeSpeed)) continue;
      for (const key of ["scrapeSpeed", "scrapeRadius", "scrapeEfficiency"]) {
        const [label, unit, digits, direction] = statLabels[key];
        rows.push(tableRow(slot.label + " · " + label.toLowerCase(), first[key], second[key], unit, digits, direction));
      }
    }
    const tractors = F.slotsOf(ship, "scraper").filter(slot => F.item(current, slot.id)?.salvageMode === "tractor").map(slot => slot.label);
    note = "Modules sélectionnés comparés au montage d’origine, qualité de fabrication comprise. Les deux modules d’une tête sont des modes distincts : leurs coefficients ne s’additionnent pas. Vitesse, rayon et efficacité s’interprètent ensemble. Le rendement réel dépend aussi du vaisseau et de l’alignement sur la coque ; ces coefficients ne sont pas un débit en SCU/min."
      + (tractors.length ? " Rayon tracteur sans décapage : " + tractors.join(", ") + "." : "");
  }
  if (category === "guns") {
    rows.push(tableRow("DPS brut total des canons", F.sum(ship, base, "gun", "dps"), F.sum(ship, current, "gun", "dps"), "DPS", 1));
    for (const slot of F.slotsOf(ship, "gun")) for (const key of ["dps", "alpha", "distance"]) rows.push(statRow(slot, key));
    note = "Les armes des tourelles et les PDC sont comptés séparément dans la composition. DPS nominaux, hors disponibilité des artilleurs, armure de la cible et alimentation des condensateurs.";
  }
  if (category === "cargo") {
    rows.push(tableRow("Capacité totale de minerai", F.sum(ship, base, "pod", "cargo"), F.sum(ship, current, "pod", "cargo"), "SCU"));
    for (const slot of F.slotsOf(ship, "pod")) { rows.push(statRow(slot, "cargo")); rows.push(statRow(slot, "hp")); }
    note = `Soute cargo séparée : ${fmt(ship.cargo)} SCU. Tampon de salvage séparé : ${fmt(ship.buffer)} SCU. La capacité de minerai additionne uniquement les pods actifs montés.`;
  }
  el("comparison").innerHTML = rows.join("");
  el("comparison-note").textContent = note;
}
function renderMining() {
  el("mining-hud").hidden = category !== "mining";
  if (category !== "mining") return;
  const head = F.slotsOf(ship, "laser")[0];
  const mining = F.mining(ship, current, head.id, el("active-modules").checked);
  el("mining-effects").innerHTML = '<div class="mining-effect-grid">' + Object.entries(effectLabels).map(([key, [label, direction]]) => {
    const value = mining.effects[key] ?? 0;
    return `<div class="mining-effect"><span>${escapeHtml(label)}</span><strong class="${!value ? "" : value * direction > 0 ? "good" : "bad"}">${value ? (value > 0 ? "↑ " : "↓ ") + signed(value, 1) + " %" : "Sans effet"}</strong></div>`;
  }).join("") + '</div><p class="mining-pieces">Pris en compte : ' + mining.pieces.map(part => escapeHtml(part.name)).join(" · ") + '.</p>';
}
function renderScraper() {
  el("salvage-compare").hidden = category !== "salvage";
  if (category !== "salvage") return;
  const part = FLEET_DATA.parts[el("scraper-comparison").value];
  el("scraper-stats").innerHTML = '<div class="scraper-values">' + ["scrapeSpeed", "scrapeRadius", "scrapeEfficiency"].map(key => {
    const [label, unit, digits] = statLabels[key];
    return `<div>${escapeHtml(label)}<strong>${fmt(part.stats[key], digits)} ${unit}</strong></div>`;
  }).join("") + '</div>';
}
function render() {
  for (const button of document.querySelectorAll("[data-category]")) button.setAttribute("aria-pressed", String(button.dataset.category === category));
  const profileOrder = [profileHint, profileHint === "balanced" ? "stock" : "balanced"];
  const profile = profileOrder.find(name => ship.slots.every(slot => current[slot.id].id === ship[name][slot.id] && !current[slot.id].quality));
  el("balanced").setAttribute("aria-pressed", String(profile === "balanced"));
  el("stock").setAttribute("aria-pressed", String(profile === "stock"));
  el("profile-name").textContent = profile === "balanced" ? "Équilibrée" : profile === "stock" ? "D’origine" : "Personnalisée";
  const drive = F.slotsOf(ship, "drive")[0];
  const quantum = F.stats(current, drive.id);
  el("metric-speed").textContent = fmt(quantum.speed, 1);
  el("metric-range").textContent = fmt(ship.fuel / quantum.burn);
  el("metric-shield").textContent = fmt(F.sum(ship, current, "shield", "shield"));
  el("fuel-label").textContent = "Sur un plein de " + fmt(ship.fuel, 2) + " SCU";
  CapacitySummary.render(el("capacity-summary"), {
    ore: ship.ore > 0 ? F.sum(ship, current, "pod", "cargo") : null,
    cargo: ship.cargo, buffer: ship.buffer > 0 ? ship.buffer : null
  });
  renderFields(); renderComparison(); renderMining(); renderScraper(); renderRoute();
}

const pointDefaults = { nyx: ["Levski", "Transit Point Glaciem Bravo"], stanton: ["Seraphim Station", "Everus Harbor"], pyro: ["Checkmate", "Ruin Station"] };
function fillPoints(side, target) {
  const system = el(side + "-system").value;
  const candidates = Object.entries(FLEET_DATA.points).filter(([, point]) => point.system === system).sort((a, b) => a[1].name.localeCompare(b[1].name));
  el(side + "-point").innerHTML = candidates.map(([id, point]) => `<option value="${escapeHtml(id)}">${escapeHtml(point.name)}</option>`).join("");
  const wanted = target ?? pointDefaults[system][side === "from" ? 0 : 1];
  const entry = candidates.find(([id, point]) => id === wanted || point.name === wanted);
  if (entry) el(side + "-point").value = entry[0];
}
function renderRoute() {
  const from = FLEET_DATA.points[el("from-point").value], to = FLEET_DATA.points[el("to-point").value];
  if (!from || !to || !ship) return;
  const legs = F.legs(from, to);
  const first = F.route(ship, base, legs, el("round-trip").checked), second = F.route(ship, current, legs, el("round-trip").checked);
  el("route-comparison").innerHTML = tableRow("Distance quantique", first.distance, second.distance, "Gm", 3)
    + tableRow("Temps quantique estimé", first.seconds, second.seconds, "s", 0, -1)
    + tableRow("Carburant quantique estimé", first.fuel, second.fuel, "SCU", 3, -1);
  el("legs").innerHTML = legs.map(leg => `<li class="${leg.distance === null ? "gate-leg" : ""}">${escapeHtml(leg.from.name)} → ${escapeHtml(leg.to.name)} · ${leg.distance === null ? "Porte de saut · temps non estimé" : fmt(leg.distance, 4) + " Gm"}</li>`).join("");
  el("route-status").textContent = second.fuel > ship.fuel ? "Carburant supérieur au plein : prévoir un ravitaillement sur ce trajet." : "Estimation compatible avec un plein de " + fmt(ship.fuel, 2) + " SCU, hors détours.";
  el("route-status").classList.toggle("status-error", second.fuel > ship.fuel);
}
function craftValues() { return [...el("recipe-fields").querySelectorAll("input")].map(input => Number(input.value)); }
function openCraft(id) {
  craftSlot = ship.slots.find(slot => slot.id === id);
  const part = F.item(current, id), recipe = part.recipe;
  el("craft-title").textContent = part.name;
  el("craft-note").textContent = craftSlot.label + " · Fabrication " + fmt(recipe.seconds) + " s · "
    + (recipe.unlock === "default" ? "Plan répertorié comme disponible par défaut." : recipe.unlock === "reward" ? "Plan répertorié dans une récompense." : "Mode d’obtention non confirmé.");
  el("craft-source").href = "https://scuplift.com/en/blueprints/" + recipe.id;
  const quality = current[id].quality ?? recipe.ingredients.map(ingredient => Math.max(ingredient.min, 500));
  el("recipe-fields").innerHTML = recipe.ingredients.map((ingredient, index) => `<div class="recipe-row"><label for="quality-${index}"><strong>${escapeHtml(materialNames[ingredient.material] ?? ingredient.material)}</strong> · ${fmt(ingredient.quantity, 3)} ${ingredient.scu ? "SCU" : "unités"}<span>${escapeHtml(ingredient.part)} · Min. ${ingredient.min}</span></label><input class="recipe-quality" id="quality-${index}" type="number" step="1" min="${ingredient.min}" max="1000" value="${quality[index]}" required></div>`).join("");
  for (const button of document.querySelectorAll("[data-quality]")) button.disabled = recipe.ingredients.some(ingredient => ingredient.min > Number(button.dataset.quality));
  el("equip-crafted").hidden = !craftSlot.editable;
  el("standard-item").hidden = !current[id].quality;
  renderCraft(); el("craft-dialog").showModal();
}
function renderCraft() {
  const part = F.item(current, craftSlot.id), quality = craftValues();
  const valid = F.validQuality(part.recipe, quality);
  el("equip-crafted").disabled = !valid;
  if (!valid) { el("craft-preview").textContent = "Respecte la qualité minimale de chaque matériau, jusqu’à 1 000."; return; }
  const crafted = F.effective(part, quality);
  const rows = Object.entries(statLabels).filter(([key]) => Number.isFinite(part.stats[key]) && (crafted[key] !== part.stats[key] || ["hp", "speed", "shield", "beam", "cargo", "cooling", "output", "scrapeSpeed", "scrapeRadius", "scrapeEfficiency"].includes(key)))
    .map(([key, [label, unit, digits, direction]]) => tableRow(label, part.stats[key], crafted[key], unit, digits, direction));
  el("craft-preview").innerHTML = '<table><caption class="sr-only">Pièce standard comparée au blueprint</caption><thead><tr><th>Indicateur</th><th>Standard</th><th>Fabriquée</th><th>Écart</th></tr></thead><tbody>' + rows.join("") + '</tbody></table>';
  const changes = F.qualityChanges(part.recipe, quality);
  const unsupported = Object.keys(changes).filter(key => !F.mappedStats[key]);
  el("craft-quality-note").textContent = (!Object.keys(changes).length ? "Cette recette ne comporte aucun bonus de qualité chiffré." : "Gains calculés à partir de chaque matériau, sans appliquer un pourcentage uniforme.")
    + (!craftSlot.editable ? " Emplacement intégré : aperçu uniquement, montage conservé." : "")
    + (unsupported.length ? " Certains effets de ce plan ne sont pas chiffrés dans ce comparateur." : "");
}

ShipNavigation.mount(() => ship?.id ?? "prospector", selectShip);
document.querySelector(".equipment-tabs").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (button) { category = button.dataset.category; render(); }
});
el("fields").addEventListener("change", event => {
  const slot = ship.slots.find(item => item.id === event.target.dataset.slot);
  if (!slot?.editable) return;
  const id = event.target.value || null;
  if (id !== null && !slot.choices.includes(id)) return;
  current[slot.id] = { id, quality: null }; F.tidy(ship, current); save(); render();
});
el("fields").addEventListener("click", event => { const button = event.target.closest("[data-craft]"); if (button) openCraft(button.dataset.craft); });
for (const profile of ["balanced", "stock"]) el(profile).addEventListener("click", () => { profileHint = profile; current = F.defaults(ship, profile); save(); render(); });
el("active-modules").addEventListener("change", () => { renderMining(); renderComparison(); });
el("scraper-comparison").innerHTML = FLEET_DATA.scrapers.map(id => `<option value="${id}">${escapeHtml(FLEET_DATA.parts[id].name)}</option>`).join("");
el("scraper-comparison").addEventListener("change", renderScraper);
for (const side of ["from", "to"]) {
  el(side + "-system").addEventListener("change", () => { fillPoints(side); renderRoute(); });
  el(side + "-point").addEventListener("change", renderRoute);
}
el("round-trip").addEventListener("change", renderRoute);
el("swap").addEventListener("click", () => {
  const from = { system: el("from-system").value, point: el("from-point").value }, to = { system: el("to-system").value, point: el("to-point").value };
  el("from-system").value = to.system; el("to-system").value = from.system;
  fillPoints("from", to.point); fillPoints("to", from.point); renderRoute();
});
el("recipe-fields").addEventListener("input", renderCraft);
for (const button of document.querySelectorAll("[data-quality]")) button.addEventListener("click", () => {
  for (const input of el("recipe-fields").querySelectorAll("input")) input.value = button.dataset.quality;
  renderCraft();
});
el("close-craft").addEventListener("click", () => el("craft-dialog").close());
el("standard-item").addEventListener("click", () => { current[craftSlot.id].quality = null; el("craft-dialog").close(); save(); render(); });
el("craft-form").addEventListener("submit", event => {
  event.preventDefault(); const quality = craftValues(); const part = F.item(current, craftSlot.id);
  if (!craftSlot.editable || !F.validQuality(part.recipe, quality)) return;
  current[craftSlot.id].quality = quality; el("craft-dialog").close(); save(); render();
});
configurationSaves = SavedConfigurations.mount({
  container: el("configurations"),
  getShip: () => ship && ({ id: ship.id, name: ship.name }),
  getState: () => current,
  normalize: loadout => F.restore(ship, loadout),
  apply: loadout => { current = F.restore(ship, loadout); save(); render(); }
});
fillPoints("from"); fillPoints("to");
selectShip(new URL(location.href).searchParams.get("vaisseau"));

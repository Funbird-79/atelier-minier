const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const scope = {};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(__dirname + '/fleet-data.js', 'utf8')
  + fs.readFileSync(__dirname + '/fleet-model.js', 'utf8') + ';globalThis.result = {FLEET_DATA, FleetModel};', scope);
const { FLEET_DATA: data, FleetModel: model } = scope.result;
const named = id => data.ships.find(ship => ship.id === id);
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }

check(data.ships.length === 7, 'Seven additional flyable ship configurations');
check(data.scrapers.every(id=>data.parts[id].name && data.parts[id].name!=='<= PLACEHOLDER =>'),'Salvage comparator excludes placeholder modules');
for (const ship of data.ships) {
  const stock = model.defaults(ship, 'stock');
  const balanced = model.defaults(ship);
  for (const slot of ship.slots) {
    check(slot.stock === null || slot.choices.includes(slot.stock), ship.id + ': stock item is compatible');
    check(balanced[slot.id].id === null || slot.choices.includes(balanced[slot.id].id), ship.id + ': preset item is compatible');
    for (const id of slot.choices) {
      check(Boolean(data.parts[id]), ship.id + ': every choice resolves');
      check(!/_test|_template|_debug|_npc/.test(id), ship.id + ': development items are excluded');
    }
    if (!slot.editable) check(balanced[slot.id].id === slot.stock, ship.id + ': integrated equipment is retained');
    for (const value of Object.values(model.stats(stock, slot.id))) check(Number.isFinite(value), ship.id + ': finite stock stats');
  }
  const restored = model.restore(ship, JSON.parse(JSON.stringify(balanced)));
  check(JSON.stringify(restored) === JSON.stringify(balanced), ship.id + ': valid loadout survives reload');
  const bad = model.restore(ship, {drive0:{id:'incompatible',quality:[2000]}});
  check(bad.drive0.id === balanced.drive0.id, ship.id + ': incompatible saved drive is rejected');
  const driveSlot = model.slotsOf(ship, 'drive')[0];
  const values = model.stats(balanced, driveSlot.id);
  const route = [{from:{name:'A'},to:{name:'B'},distance:20}];
  const oneWay = model.route(ship, balanced, route, false);
  const roundTrip = model.route(ship, balanced, route, true);
  check(oneWay.seconds > 0 && oneWay.fuel > 0, ship.id + ': route estimates are finite and positive');
  check(roundTrip.seconds === oneWay.seconds*2 && roundTrip.fuel === oneWay.fuel*2, ship.id + ': round trip doubles travel');
  check(ship.fuel/values.burn > 0, ship.id + ': finite quantum range');
}

const prospector = named('prospector');
const loadout = model.defaults(prospector, 'stock');
for (const [pod, capacity] of [['cargo_shipmining_pod_prospector',32],['cargo_shipmining_pod_mole',48],['cargo_shipmining_pod_moleprospector_btgl',60]]) {
  for (const slot of model.slotsOf(prospector,'pod')) loadout[slot.id] = {id:pod,quality:null};
  check(model.sum(prospector,loadout,'pod','cargo') === capacity, 'Prospector active pods: '+capacity+' SCU');
}
loadout.pod0 = {id:'cargo_shipmining_pod_prospector',quality:null};
loadout.pod1 = {id:'cargo_shipmining_pod_mole',quality:null};
check(model.sum(prospector,loadout,'pod','cargo') === 50,'Prospector mixed pods are added individually');
check(model.slotsOf(prospector,'pod').length === 4,'Collapsed spare Prospector bags do not double active capacity');

const golem = named('golem'), golemLoadout = model.defaults(golem,'stock');
check(model.sum(golem,golemLoadout,'pod','cargo') === 32,'Golem has two original 16 SCU pods');
for (const slot of model.slotsOf(golem,'pod')) {
  check(!slot.choices.includes('cargo_shipmining_pod_mole'),'Golem does not accept MOLE pods');
  golemLoadout[slot.id] = {id:'cargo_shipmining_pod_golem_btgl',quality:null};
}
check(model.sum(golem,golemLoadout,'pod','cargo') === 40,'Golem MC-4 pods total 40 SCU');
const enhanced = data.parts.cargo_shipmining_pod_moleprospector_btgl;
check(!model.validQuality(enhanced.recipe,[500]),'Enhanced pod blueprint rejects quality below 800');
check(model.validQuality(enhanced.recipe,[800]),'Enhanced pod blueprint accepts quality 800');
check(model.effective(enhanced,[800]).cargo === 15,'Blueprint quality does not invent extra pod volume');

loadout.laser0 = {id:'mining_laser_thcn_helix_s1',quality:null};
loadout['module0-1'] = {id:'mining_modules_passive_deluge',quality:null};
loadout.laser0 = {id:'mining_laser_grin_arbor_s1',quality:null};
model.tidy(prospector,loadout);
check(loadout['module0-1'].id === null,'Reducing mining head slots removes the extra module');
const helix = data.parts.mining_laser_thcn_helix_s1;
const quality = helix.recipe.ingredients.map(ingredient=>Math.max(800,ingredient.min));
check(model.validQuality(helix.recipe,quality),'Head blueprint quality is valid');
check(model.effective(helix,quality).beam > helix.stats.beam,'Crafted mining head gains match its blueprint');

const reclaimer = named('reclaimer');
check(model.slotsOf(reclaimer,'shield').length === 1 && model.slotsOf(reclaimer,'shield')[0].size === 4,'Reclaimer has its dedicated S4 shield');
check(model.slotsOf(reclaimer,'power')[0].editable === false,'Reclaimer power plant is integrated');
check(model.slotsOf(reclaimer,'gun').filter(slot=>!slot.editable).length === 7,'Reclaimer has seven fixed PDC guns');
check(model.slotsOf(reclaimer,'gun').filter(slot=>slot.size===5).length === 2,'Reclaimer two S5 guns remain distinct from S3 guns');
for (const [id,buffer] of [['vulture',16],['fortune',14],['salvation',8],['moth',240],['reclaimer',448]]) check(named(id).buffer === buffer,id+': 4.10.3 buffer is separate from cargo');
const from = Object.values(data.points).find(p=>p.system==='nyx'), to = Object.values(data.points).find(p=>p.system==='pyro');
const legs = model.legs(from,to);
check(legs.length===3 && legs[1].distance===null,'Cross-system route retains the unestimated jump gate');
console.log(`${checks} checks passed for seven ships, compatibility, presets, pods, quality, modules and routes.`);

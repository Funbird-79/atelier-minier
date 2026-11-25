const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync(__dirname + '/' + name, 'utf8');
const fleet = {}, hyun = {};
vm.createContext(fleet); vm.createContext(hyun);
vm.runInContext(read('fleet-data.js') + read('fleet-model.js')
  + ';globalThis.data=FLEET_DATA;globalThis.model=FleetModel;', fleet);
vm.runInContext(read('hyun-data.js') + read('hyun-model.js')
  + ';globalThis.data=ARGO_DATA;globalThis.model={defaults:defaultLoadout,restore:restoreLoadout,stats:loadoutStats,modules:salvageModuleSlots};', hyun);
const ids = ['salvage_modifier_scraper_medium', 'salvage_modifier_scraper_small',
  'salvage_modifier_scraper_large', 'salvage_modifier_tractor_small'];
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function near(actual, expected, message) { check(Math.abs(actual - expected) < 1e-9, message); }
for (const [name, count] of [['vulture',4],['fortune',2],['moth',6],['reclaimer',4]]) {
  const ship = fleet.data.ships.find(ship=>ship.id===name);
  const slots = fleet.model.slotsOf(ship, 'scraper');
  check(slots.length===count, name + ': original occupied module slots preserved');
  for (const slot of slots) {
    check(slot.editable && slot.choices.length===4 && ids.every(id=>slot.choices.includes(id)), name + ': all four Baler modules can be mounted');
    for (const id of ids) {
      const mount = fleet.model.defaults(ship, 'stock'); mount[slot.id]={id,quality:null};
      const loaded = fleet.model.restore(ship, JSON.parse(JSON.stringify(mount)));
      check(loaded[slot.id].id===id, name + ': selected module survives reload');
      check(ship.slots.filter(other=>other.id!==slot.id).every(other=>loaded[other.id].id===mount[other.id].id), name + ': other equipment is unaffected');
    }
  }
  const selected = slots[0];
  const mount = fleet.model.defaults(ship, 'stock');
  mount[selected.id] = {id:ids[1],quality:[800,800,800]};
  const loaded = fleet.model.restore(ship, mount);
  check(loaded[selected.id].quality?.every(q=>q===800), name + ': crafted Cinch can be equipped');
  near(fleet.model.stats(loaded,selected.id).scrapeSpeed, 0.672, name + ': Q800 speed follows ingredient curves');
  near(fleet.model.stats(loaded,selected.id).scrapeRadius, 1.68, name + ': Q800 radius follows ingredient curves');
  near(fleet.model.stats(loaded,selected.id).scrapeEfficiency, 112, name + ': Q800 module efficiency follows ingredient curves');
}
check(hyun.data.parts.scraper.length===4 && ids.every(id=>hyun.data.parts.scraper.some(part=>part.id===id)), 'Hyun has the same four Baler modules');
check(hyun.model.defaults('stock').scraper2.id===null && hyun.model.defaults('stock').scraper3.id===null,'Hyun: second modules are optional and empty in the stock loadout');
check(JSON.stringify(hyun.model.modules('salvage0'))==='["scraper0","scraper2"]' && JSON.stringify(hyun.model.modules('salvage1'))==='["scraper1","scraper3"]','Hyun: each arm has two independent modules and original left/right IDs are preserved');
for (const slot of ['scraper0','scraper1','scraper2','scraper3']) {
  const mount = hyun.model.defaults('stock');
  mount[slot]={id:ids[0],quality:[800,800,800]};
  const loaded=hyun.model.restore(mount);
  near(hyun.model.stats(loaded,slot).scrapeSpeed,0.168,'Hyun: Q800 Abrade uses a speed coefficient, not a percentage');
  near(hyun.model.stats(loaded,slot).scrapeRadius,3.92,'Hyun: crafted radius applies');
  near(hyun.model.stats(loaded,slot).scrapeEfficiency,100.8,'Hyun: crafted module efficiency applies');
  mount[slot]={id:ids[3],quality:null};
  check(hyun.model.restore(mount)[slot].id===ids[3],'Hyun: ReadyGrip survives reload');
  check(hyun.model.stats(hyun.model.restore(mount),slot).scrapeSpeed===undefined,'Hyun: ReadyGrip does not claim RMC output');
}
const paired=hyun.model.defaults('stock');
paired.scraper0={id:ids[0],quality:[800,800,800]};paired.scraper2={id:ids[1],quality:[1000,1000,1000]};
paired.scraper1={id:ids[2],quality:[500,500,500]};paired.scraper3={id:ids[3],quality:null};
const reloaded=hyun.model.restore(JSON.parse(JSON.stringify(paired)));
check(JSON.stringify(reloaded)===JSON.stringify(paired),'Hyun: four distinct modules and their independent qualities survive reload');
near(hyun.model.stats(reloaded,'scraper0').scrapeSpeed,0.168,'A second module does not add its coefficient to the first');
paired.scraper2={id:null,quality:null};
check(hyun.model.restore(paired).scraper2.id===null && hyun.model.restore(paired).scraper0.id===ids[0],'Hyun: removing the optional second module preserves the first');
check(fleet.data.parts[ids[3]].salvageMode==='tractor' && fleet.data.parts[ids[3]].stats.scrapeEfficiency===undefined,'ReadyGrip is identified as a tractor, not a 100% scraper');
const salvation=fleet.data.ships.find(ship=>ship.id==='salvation');
for (const slot of fleet.model.slotsOf(salvation,'scraper')) {
  check(!slot.editable && slot.choices.length===1,'Salvation retains its bespoke attachment restriction');
  const mount=fleet.model.defaults(salvation,'stock');mount[slot.id]={id:ids[0],quality:[800,800,800]};
  check(fleet.model.restore(salvation,mount)[slot.id].id===slot.stock,'Salvation rejects incompatible imported modules');
}
check(hyun.model.restore(hyun.model.defaults('stock')).scraper0.id===ids[0],'Existing Hyun stock saves still load');
console.log(`${checks} checks passed: salvage selection, occupied slots, Q800 effects, reload, ReadyGrip and Salvation exception.`);

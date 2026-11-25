const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function equal(a, b, message) { assert.deepEqual(clone(a), clone(b), message); checks++; }
function rejects(action, pattern) { assert.throws(action, pattern); checks++; }
const contexts = [];
for (const [id, name, data, model] of [
  ['mole', 'ARGO MOLE', 'catalog.js', 'model.js'], ['hyun', 'Gatac Hyūn', 'hyun-data.js', 'hyun-model.js']
]) {
  const scope = {}; vm.createContext(scope);
  vm.runInContext(source(data) + source(model) + source('configurations.js')
    + ';globalThis.fixture = {store:SavedConfigurations, defaults:()=>defaultLoadout("balanced"), normalize:restoreLoadout, parts:ARGO_DATA.parts};', scope);
  contexts.push({ id, name, ...scope.fixture });
}
const scope = {}; vm.createContext(scope);
vm.runInContext(source('fleet-data.js') + source('fleet-model.js') + source('configurations.js')
  + ';globalThis.fixture={store:SavedConfigurations,model:FleetModel,data:FLEET_DATA};', scope);
for (const ship of scope.fixture.data.ships) contexts.push({
  id: ship.id, name: ship.name, store: scope.fixture.store,
  defaults: () => scope.fixture.model.defaults(ship), normalize: loadout => scope.fixture.model.restore(ship, loadout),
  ship, data: scope.fixture.data
});
const bytes = new Map();
const storage = { getItem:key=>bytes.get(key)??null, setItem:(key,value)=>bytes.set(key,value) };
bytes.set('atelier-minier-hyun-loadout-v1', 'existing autosave');

for (const context of contexts) {
  const snapshot = clone(context.defaults());
  const drive = Object.keys(snapshot).find(key=>key.startsWith('drive'));
  const drivePart = context.data ? context.data.parts[snapshot[drive].id]
    : context.parts.drive.find(part=>part.id===snapshot[drive].id);
  if (drivePart.recipe) snapshot[drive].quality = drivePart.recipe.ingredients.map(ingredient=>Math.max(800,ingredient.min));
  if (context.parts?.paint?.length) snapshot.paint.id = context.parts.paint[0].id;
  const scraper = context.ship?.slots.find(slot=>slot.group==='scraper' && slot.editable)?.id
    ?? (context.parts?.scraper ? 'scraper0' : null);
  if (scraper) {
    const id = 'salvage_modifier_scraper_large';
    const part = context.data ? context.data.parts[id] : context.parts.scraper.find(part=>part.id===id);
    snapshot[scraper] = {id, quality:part.recipe.ingredients.map(ingredient=>Math.max(800,ingredient.min))};
  }
  if (context.id==='hyun') {
    snapshot.scraper2={id:'salvage_modifier_scraper_small',quality:[1000,1000,1000]};
    snapshot.scraper3={id:'salvage_modifier_tractor_small',quality:null};
  }
  const valid = context.normalize(snapshot);
  equal(valid, snapshot, context.id + ': fixture includes valid crafting quality and paint');
  const make = () => context.store.createStore(storage, context, context.normalize);
  const store = make();
  const record = store.save('  Nyx · équipe 800  ', snapshot);
  check(record.name === 'Nyx · équipe 800', context.id + ': name is trimmed');
  equal(store.load(record.id).loadout, snapshot, context.id + ': every component and material quality restored');
  const detached = store.load(record.id);
  detached.loadout[drive].quality = null;
  equal(store.load(record.id).loadout, snapshot, context.id + ': snapshots are independent');
  const standard = clone(context.defaults());
  const second = store.save('Stanton · standard', standard);
  check(store.read().records.length === 2, context.id + ': multiple named configurations');
  equal(make().load(record.id).loadout, snapshot, context.id + ': records survive recreation/reload');
  const before = clone(store.read());
  rejects(()=>store.save('nyx · équipe 800', standard), /nom existe/);
  equal(store.read(), before, context.id + ': duplicate name cannot overwrite another save');
  const updated = store.save(second.name, snapshot, second.id);
  check(updated.id === second.id && store.read().records.length === 2, context.id + ': updating retains identity');
  equal(store.load(second.id).loadout, snapshot, context.id + ': updated loadout persisted');
  const exported = store.serialize(record.name, snapshot);
  const imported = store.importText(exported);
  check(imported.id !== record.id && imported.name === record.name+' (2)', context.id + ': importing creates a separate save');
  equal(store.load(imported.id).loadout, snapshot, context.id + ': exported file round trip is lossless');
  const originalBytes = bytes.get('atelier-minier-configurations-'+context.id+'-v1');
  const foreign = JSON.parse(exported); foreign.ship.id='wrong-ship';
  rejects(()=>store.importText(JSON.stringify(foreign)), /autre vaisseau/);
  check(bytes.get('atelier-minier-configurations-'+context.id+'-v1')===originalBytes, context.id + ': wrong-ship import leaves saves intact');
  const invalid = clone(snapshot); invalid[drive].id='incompatible_component';
  rejects(()=>store.save('Invalid', invalid), /incompatibles/);
  invalid[drive] = {id:snapshot[drive].id, quality:[1001]};
  rejects(()=>store.save('Invalid',invalid), /invalides/);
  store.remove(record.id);
  check(!make().read().records.some(item=>item.id===record.id), context.id + ': deletion saved');
  const undone = make().undo();
  check(undone.id === record.id, context.id + ': undo survives reload');
  equal(make().load(undone.id).loadout, snapshot, context.id + ': undo preserves the whole snapshot');
}

const context = contexts[0], store = context.store.createStore(storage,context,context.normalize);
const hyun=contexts.find(context=>context.id==='hyun');
const legacy=clone(hyun.defaults());delete legacy.scraper2;delete legacy.scraper3;
legacy.scraper0={id:'salvage_modifier_scraper_large',quality:[800,800,800]};
const legacyRecord={id:'old-hyun',name:'Ancienne configuration',savedAt:'2026-11-24T12:00:00.000Z',loadout:legacy};
let oldBytes=JSON.stringify({version:1,records:[legacyRecord],deleted:null});
const beforeMigration=oldBytes;
const oldStore=hyun.store.createStore({getItem:()=>oldBytes,setItem:(key,value)=>{oldBytes=value;}},hyun,hyun.normalize);
const migrated=oldStore.load('old-hyun').loadout;
equal(Object.fromEntries(Object.entries(migrated).filter(([key])=>!['scraper2','scraper3'].includes(key))),legacy,'Hyun: old named saves preserve every existing component and quality');
equal(migrated.scraper2,{id:null,quality:null},'Hyun: legacy save gains an empty second left module');
equal(migrated.scraper3,{id:null,quality:null},'Hyun: legacy save gains an empty second right module');
check(oldBytes===beforeMigration,'Loading a legacy save does not rewrite the stored original');
const legacyFile={format:'atelier-minier-configuration',version:1,ship:{id:'hyun',name:'Gatac Hyūn'},name:'Ancien export',loadout:legacy};
const importedLegacy=oldStore.importText(JSON.stringify(legacyFile));
equal(oldStore.load(importedLegacy.id).loadout,migrated,'Hyun: previous JSON exports import without losing the setup');
const missingOccupied=clone(legacy);delete missingOccupied.drive;
rejects(()=>oldStore.save('Invalid missing drive',missingOccupied),/incompatibles/);
const extraPort=clone(migrated);extraPort.scraper4={id:null,quality:null};
rejects(()=>oldStore.save('Invalid extra slot',extraPort),/incompatibles/);
rejects(()=>store.importText('not json'), /lisible/);
rejects(()=>store.importText('{}'), /compatible/);
rejects(()=>store.importText('x'.repeat(250001)), /volumineux/);
const invalidVersion=JSON.parse(store.serialize('Version',context.defaults())); invalidVersion.version=999;
rejects(()=>store.importText(JSON.stringify(invalidVersion)), /compatible/);
const empty = context.store.createStore({getItem:()=>null,setItem:()=>{throw Error('quota');}},context,context.normalize);
rejects(()=>empty.save('No space',context.defaults()), /n’a pas été enregistrée/);
const blocked=context.store.createStore({getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('must not write');}},context,context.normalize);
rejects(()=>blocked.read(), /bloque/);
check(JSON.parse(blocked.serialize('File still works',context.defaults())).loadout, 'Export works when browser storage is blocked');
let corrupted='broken';
const corrupt=context.store.createStore({getItem:()=>corrupted,setItem:value=>{corrupted=value;}},context,context.normalize);
rejects(()=>corrupt.save('New',context.defaults()), /illisibles/);
check(corrupted==='broken', 'Corrupted saved data is not overwritten');
check(bytes.get('atelier-minier-hyun-loadout-v1')==='existing autosave','Existing automatic-save key is left unchanged');
check([...bytes.keys()].filter(key=>key.startsWith('atelier-minier-configurations-')).length===9, 'Named saves are isolated across nine ships');
console.log(`${checks} checks passed: nine ships, named saves, updates, reload, quality, paint, export/import, deletion undo, invalid files and storage failure.`);

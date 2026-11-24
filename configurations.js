"use strict";

const SavedConfigurations = (() => {
  const FORMAT = "atelier-minier-configuration";
  const VERSION = 1;
  const MAX_FILE_SIZE = 250000;
  const copy = value => JSON.parse(JSON.stringify(value));
  const shipKey = ship => "atelier-minier-configurations-" + ship.id + "-v1";
  const cleanName = value => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  const nameKey = name => name.toLocaleLowerCase("fr-FR");
  const sameLoadout = (a, b) => {
    const keys = Object.keys(a).sort(), otherKeys = Object.keys(b).sort();
    return JSON.stringify(keys) === JSON.stringify(otherKeys) && keys.every(key =>
      a[key].id === b[key]?.id && JSON.stringify(a[key].quality) === JSON.stringify(b[key]?.quality));
  };
  function validateLoadout(loadout, normalize) {
    if (!loadout || typeof loadout !== "object" || Array.isArray(loadout)) throw new Error("Le fichier ne contient pas de configuration valide.");
    const entries = Object.entries(loadout);
    if (!entries.length || entries.length > 200 || entries.some(([key, value]) =>
      !/^[a-z][a-z0-9-]{0,79}$/.test(key) || !value || typeof value !== "object" || Array.isArray(value)
      || !(value.id === null || typeof value.id === "string" && value.id.length <= 180)
      || !(value.quality === null || Array.isArray(value.quality) && value.quality.length <= 40
        && value.quality.every(quality => Number.isInteger(quality) && quality >= 0 && quality <= 1000)))) {
      throw new Error("Les composants ou les qualités de cette configuration sont invalides.");
    }
    let restored;
    try { restored = normalize(copy(loadout)); }
    catch { throw new Error("Cette configuration ne convient pas à ce vaisseau."); }
    if (!sameLoadout(loadout, restored)) throw new Error("Cette configuration contient des composants ou des qualités incompatibles avec ce vaisseau.");
    return copy(restored);
  }
  const newId = () => "config-" + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
  function uniqueName(name, records) {
    let result = name;
    for (let number = 2; records.some(record => nameKey(record.name) === nameKey(result)); number++) {
      result = name.slice(0, 72) + " (" + number + ")";
    }
    return result;
  }
  function createStore(storage, ship, normalize) {
    const key = shipKey(ship);
    function read() {
      let text;
      try { text = storage.getItem(key); }
      catch { throw new Error("Le navigateur bloque la sauvegarde locale. Tu peux télécharger un fichier de configuration."); }
      if (text === null) return { version: VERSION, records: [], deleted: null };
      let state;
      try {
        state = JSON.parse(text);
        if (state?.version !== VERSION || !Array.isArray(state.records) || state.records.length > 100) throw new Error();
        const records = state.records.concat(state.deleted ? [state.deleted] : []);
        if (records.some(record => !record || typeof record.id !== "string" || !cleanName(record.name)
          || typeof record.savedAt !== "string" || !record.loadout || typeof record.loadout !== "object")) throw new Error();
        if (new Set(state.records.map(record => record.id)).size !== state.records.length) throw new Error();
      } catch { throw new Error("Les sauvegardes locales sont illisibles. Elles ont été conservées. Télécharge une copie de ta configuration actuelle."); }
      return copy(state);
    }
    function write(state) {
      try { storage.setItem(key, JSON.stringify(state)); }
      catch { throw new Error("La configuration n’a pas été enregistrée : stockage du navigateur indisponible ou plein. Télécharge une copie."); }
    }
    function save(name, loadout, id = null, deduplicate = false) {
      name = cleanName(name);
      if (!name) throw new Error("Donne un nom à ta configuration.");
      const snapshot = validateLoadout(loadout, normalize);
      const state = read();
      const previous = state.records.find(record => record.id === id);
      if (id && !previous) throw new Error("Cette sauvegarde n’existe plus. Enregistre la configuration sous un nouveau nom.");
      const others = state.records.filter(record => record.id !== id);
      if (deduplicate) name = uniqueName(name, others);
      else if (others.some(record => nameKey(record.name) === nameKey(name))) throw new Error("Ce nom existe déjà. Choisis un autre nom ou sélectionne la sauvegarde à mettre à jour.");
      if (!previous && state.records.length >= 100) throw new Error("Tu as déjà 100 configurations pour ce vaisseau. Supprime une sauvegarde ou télécharge un fichier.");
      const record = { id: previous?.id ?? newId(), name, savedAt: new Date().toISOString(), loadout: snapshot };
      state.records = [record, ...others];
      write(state);
      return copy(record);
    }
    function load(id) {
      const record = read().records.find(record => record.id === id);
      if (!record) throw new Error("Sélectionne une configuration enregistrée.");
      return { ...record, loadout: validateLoadout(record.loadout, normalize) };
    }
    function remove(id) {
      const state = read();
      const record = state.records.find(record => record.id === id);
      if (!record) throw new Error("Sélectionne une configuration à supprimer.");
      state.records = state.records.filter(record => record.id !== id);
      state.deleted = record;
      write(state);
      return copy(record);
    }
    function undo() {
      const state = read();
      if (!state.deleted) throw new Error("Aucune suppression à annuler pour ce vaisseau.");
      if (state.records.length >= 100) throw new Error("Libère une place parmi les configurations de ce vaisseau avant de restaurer celle-ci.");
      const record = state.deleted;
      record.name = uniqueName(record.name, state.records);
      record.id = state.records.some(existing => existing.id === record.id) ? newId() : record.id;
      state.records.unshift(record); state.deleted = null;
      write(state);
      return copy(record);
    }
    function serialize(name, loadout) {
      return JSON.stringify({ format: FORMAT, version: VERSION, ship: { id: ship.id, name: ship.name },
        name: cleanName(name) || "Configuration " + ship.name, savedAt: new Date().toISOString(),
        loadout: validateLoadout(loadout, normalize) }, null, 2);
    }
    function importText(text) {
      if (typeof text !== "string" || text.length > MAX_FILE_SIZE) throw new Error("Le fichier est trop volumineux pour une configuration.");
      let payload;
      try { payload = JSON.parse(text.replace(/^\uFEFF/, "")); }
      catch { throw new Error("Le fichier ne contient pas une configuration Atelier minier lisible."); }
      if (payload?.format !== FORMAT || payload.version !== VERSION || typeof payload.ship?.id !== "string") throw new Error("Ce fichier n’est pas une configuration Atelier minier compatible.");
      if (payload.ship.id !== ship.id) throw new Error("Ce fichier appartient à un autre vaisseau. Sélectionne le vaisseau correspondant avant de l’importer.");
      return save(payload.name || "Configuration importée", payload.loadout, null, true);
    }
    return { read, save, load, remove, undo, serialize, importText };
  }

  function mount({ container, getShip, getState, normalize, apply }) {
    container.innerHTML = `<section class="named-configs" aria-labelledby="configs-title">
      <h3 id="configs-title">Mes configurations</h3>
      <p class="configs-help">Plusieurs sauvegardes par vaisseau, dans ce navigateur. Télécharge un fichier pour garder une copie ailleurs.</p>
      <div class="configs-field"><label for="config-name">Nom de la configuration</label><input id="config-name" type="text" maxlength="80" autocomplete="off" placeholder="Ex. Nyx · minage Q800"></div>
      <button type="button" class="primary config-save" id="config-save">Enregistrer</button>
      <div class="configs-field"><label for="config-list">Configurations enregistrées</label><select id="config-list"><option value="">Choisir une configuration…</option></select></div>
      <div class="configs-actions"><button type="button" class="secondary" id="config-load" disabled>Charger</button><button type="button" class="secondary" id="config-delete" disabled>Supprimer</button></div>
      <div class="configs-files"><button type="button" class="secondary" id="config-export" aria-label="Télécharger la configuration actuelle">Télécharger</button><button type="button" class="secondary" id="config-import">Importer un fichier</button><input id="config-file" type="file" accept=".json,application/json" hidden></div>
      <p id="config-status" class="configs-status" role="status" aria-live="polite"></p>
      <button type="button" class="secondary config-undo" id="config-undo" hidden>Annuler la suppression</button>
    </section>`;
    const ui = id => container.querySelector("#" + id);
    let activeShip, store, records = [];
    function announce(text, error = false) {
      ui("config-status").textContent = text;
      ui("config-status").classList.toggle("config-error", error);
    }
    function controls() {
      const selected = records.find(record => record.id === ui("config-list").value);
      ui("config-load").disabled = !selected;
      ui("config-delete").disabled = !selected;
      ui("config-save").textContent = selected && cleanName(ui("config-name").value) === selected.name ? "Mettre à jour" : "Enregistrer";
    }
    function refresh(selectedId = "") {
      const state = store.read();
      records = state.records;
      ui("config-list").replaceChildren(new Option("Choisir une configuration…", ""),
        ...records.map(record => new Option(record.name, record.id)));
      ui("config-list").value = records.some(record => record.id === selectedId) ? selectedId : "";
      ui("config-undo").hidden = !state.deleted;
      controls();
    }
    function run(action) {
      try { action(); }
      catch (error) { announce(error.message || "L’opération n’a pas abouti.", true); }
    }
    function syncShip() {
      const ship = getShip();
      if (!ship || ship.id === activeShip) return;
      activeShip = ship.id;
      store = createStore({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, ship, normalize);
      records = [];
      ui("config-list").replaceChildren(new Option("Choisir une configuration…", ""));
      ui("config-undo").hidden = true;
      ui("config-name").value = "";
      ui("config-file").value = "";
      controls();
      announce("");
      run(() => refresh());
    }
    ui("config-name").addEventListener("input", controls);
    ui("config-name").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); ui("config-save").click(); }
    });
    ui("config-list").addEventListener("change", () => {
      const selected = records.find(record => record.id === ui("config-list").value);
      ui("config-name").value = selected?.name ?? "";
      controls(); announce("");
    });
    ui("config-save").addEventListener("click", () => run(() => {
      const selected = records.find(record => record.id === ui("config-list").value);
      const update = selected && cleanName(ui("config-name").value) === selected.name;
      const record = store.save(ui("config-name").value, getState(), update ? selected.id : null);
      ui("config-name").value = record.name; refresh(record.id);
      announce("« " + record.name + " » " + (update ? "mise à jour" : "enregistrée") + ".");
    }));
    ui("config-load").addEventListener("click", () => run(() => {
      const record = store.load(ui("config-list").value);
      apply(copy(record.loadout));
      announce("« " + record.name + " » chargée.");
    }));
    ui("config-delete").addEventListener("click", () => run(() => {
      const record = store.remove(ui("config-list").value);
      ui("config-name").value = ""; refresh();
      announce("« " + record.name + " » supprimée. Tu peux annuler cette suppression.");
    }));
    ui("config-undo").addEventListener("click", () => run(() => {
      const record = store.undo(); ui("config-name").value = record.name; refresh(record.id);
      announce("« " + record.name + " » restaurée.");
    }));
    ui("config-export").addEventListener("click", () => run(() => {
      const text = store.serialize(ui("config-name").value, getState());
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      const name = cleanName(ui("config-name").value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
      link.href = url; link.download = getShip().id + "-" + (name || "configuration") + ".json";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce("Fichier de la configuration actuelle préparé pour le téléchargement.");
    }));
    ui("config-import").addEventListener("click", () => ui("config-file").click());
    ui("config-file").addEventListener("change", async () => {
      const file = ui("config-file").files[0], shipAtStart = activeShip;
      if (!file) return;
      try {
        if (file.size > MAX_FILE_SIZE) throw new Error("Le fichier est trop volumineux pour une configuration.");
        const text = await file.text();
        if (activeShip !== shipAtStart) throw new Error("Le vaisseau a changé. Importe le fichier sur le vaisseau correspondant.");
        const record = store.importText(text);
        ui("config-name").value = record.name; refresh(record.id);
        announce("« " + record.name + " » importée et enregistrée. Clique sur Charger pour la monter.");
      } catch (error) { announce(error.message || "Impossible de lire ce fichier.", true); }
      finally { ui("config-file").value = ""; }
    });
    syncShip();
    return { syncShip };
  }
  return { createStore, mount, validateLoadout, sameLoadout, cleanName };
})();

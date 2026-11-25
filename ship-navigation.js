"use strict";

const ShipNavigation = (() => {
  const groups = [
    ["Minage", [["mole", "ARGO MOLE"], ["prospector", "MISC Prospector"], ["golem", "Drake Golem"]]],
    ["Minage et salvage", [["hyun", "Gatac Hyūn"]]],
    ["Salvage", [["vulture", "Drake Vulture"], ["fortune", "MISC Fortune"], ["salvation", "RSI Salvation"], ["moth", "ARGO MOTH"], ["reclaimer", "Aegis Reclaimer"]]]
  ];
  const ids = new Set(groups.flatMap(([, ships]) => ships.map(([id]) => id)));
  function destination(id) {
    if (!ids.has(id)) return null;
    return id === "mole" ? "index.html" : id === "hyun" ? "hyun.html" : "flotte.html?vaisseau=" + id;
  }
  function mount(getCurrent, onFleetChange) {
    const picker = document.getElementById("ship-picker");
    const current = typeof getCurrent === "function" ? getCurrent : () => getCurrent;
    picker.replaceChildren(...groups.map(([name, ships]) => {
      const group = document.createElement("optgroup"); group.label = name;
      group.append(...ships.map(([id, name]) => new Option(name, id)));
      return group;
    }));
    const sync = () => { picker.value = current() ?? "prospector"; };
    picker.addEventListener("change", () => {
      const id = picker.value;
      if (!ids.has(id) || id === current()) return;
      if (onFleetChange && id !== "mole" && id !== "hyun") onFleetChange(id);
      else location.href = destination(id);
    });
    window.addEventListener("pageshow", sync);
    sync();
  }
  return { destination, mount, groups };
})();

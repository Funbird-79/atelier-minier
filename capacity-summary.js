"use strict";

const CapacitySummary = (() => {
  const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  function render(container, { ore, cargo, buffer }) {
    const entries = [["Minerai monté", ore], ["Soute cargo", cargo], ["Tampon salvage", buffer]]
      .filter(([, value]) => Number.isFinite(value) && value >= 0);
    container.replaceChildren(...entries.map(([label, value]) => {
      const field = document.createElement("div");
      const total = document.createElement("strong");
      total.textContent = number.format(value) + " SCU";
      field.append(label, total);
      return field;
    }));
  }
  return { render };
})();

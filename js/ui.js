// Rendu de l'écran principal : carte du moment, bande horaire, onglets
// (graphique, 7 jours, comparaison des modèles).

import { icone, infoCode } from "./icones-meteo.js";
import { calculerConfiance } from "./confiance.js";
import { courbe } from "./graphique.js";
import { MODELES, LABELS_MODELES } from "./config.js";
import { estFavori } from "./storage.js";

const $ = (id) => document.getElementById(id);
const arrondi = (x) => (Number.isFinite(x) ? Math.round(x) : "—");

function heureCourte(iso) {
  return `${new Date(iso).getHours()}h`;
}

function nomJour(iso, i) {
  if (i === 0) return "Aujourd'hui";
  if (i === 1) return "Demain";
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
}

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Index de l'heure la plus proche de maintenant dans la série horaire.
function indexMaintenant(temps) {
  const maintenant = Date.now();
  let meilleur = 0;
  let ecartMin = Infinity;
  temps.forEach((t, i) => {
    const e = Math.abs(new Date(t).getTime() - maintenant);
    if (e < ecartMin) {
      ecartMin = e;
      meilleur = i;
    }
  });
  return meilleur;
}

function valeursModeles(parChamp, champ, i) {
  return MODELES.map((m) => parChamp[champ]?.[m]?.[i]).filter((x) => Number.isFinite(x));
}

// Valeur "affichage" pour un champ : le modèle français (le plus précis sur
// la France) en priorité, mais celui-ci ne couvre que ~4 jours -- au-delà,
// on prend le premier autre modèle qui a une valeur à cet indice, plutôt que
// d'afficher un blanc. Utilisé partout où une seule valeur (pas la
// comparaison) doit être montrée.
function valeurAffichage(parChamp, champ, i) {
  for (const m of MODELES) {
    const v = parChamp[champ]?.[m]?.[i];
    if (Number.isFinite(v)) return v;
  }
  return null;
}

export function afficherChargement() {
  $("ma-contenu").innerHTML = `<div class="ma-chargement"><div class="spin"></div>Chargement de la météo…</div>`;
}

export function afficherErreur(message, onReessayer) {
  $("ma-contenu").innerHTML = `<div class="ma-erreur">⚠️ ${message}<br><button type="button" id="ma-reessayer-btn">Réessayer</button></div>`;
  $("ma-reessayer-btn").addEventListener("click", onReessayer);
}

function pastilleConfiance(conf) {
  return `<div class="ma-confiance ${conf.niveau}" id="ma-confiance-pill">
    <span class="pt">${conf.score}/100</span> · ${conf.texte}
  </div>`;
}

function detailsConfianceHtml(conf) {
  return `<div class="ma-details-confiance">${conf.details
    .map((d) => `<div class="ma-detail ${d.points > 0 ? "bon" : d.points < 0 ? "mauvais" : "neutre"}">${d.points > 0 ? "✅" : d.points < 0 ? "⚠️" : "•"} <span><b>${d.label}</b></span></div>`)
    .join("")}</div>`;
}

let onglet = "graphique";
let metriqueGraphique = "temperature_2m";
let etatCourant = null;

export function afficherMeteo(etat) {
  etatCourant = etat;
  const { actuel, modeles } = etat;
  const iM = indexMaintenant(modeles.horaire.temps);
  const info = infoCode(actuel.weathercode, actuel.is_day);

  const confHoraire = calculerConfiance({
    tempsC: valeursModeles(modeles.horaire.parChamp, "temperature_2m", iM),
    precipPct: valeursModeles(modeles.horaire.parChamp, "precipitation_probability", iM),
    ventKmh: valeursModeles(modeles.horaire.parChamp, "wind_speed_10m", iM),
  });

  $("ma-lieu-nom").textContent = etat.lieu.nom;
  $("ma-lieu-admin").textContent = etat.lieu.admin || "";
  $("ma-favori-btn").textContent = estFavori(etat.lieu.nom, etat.lieu.lat, etat.lieu.lon) ? "★" : "☆";
  $("ma-favori-btn").classList.toggle("actif", estFavori(etat.lieu.nom, etat.lieu.lat, etat.lieu.lon));

  $("ma-contenu").innerHTML = `
    <section class="ma-hero">
      <div class="ma-hero-top">
        <div>
          <div class="ma-temp">${arrondi(actuel.temperature_2m)}<sup>°</sup></div>
          <div class="ma-hero-desc">${info.texte}</div>
          <div class="ma-hero-ressenti">Ressenti ${arrondi(actuel.apparent_temperature)}°</div>
        </div>
        <div class="ma-hero-icone">${icone(info.icone, 84)}</div>
      </div>
      <div class="ma-hero-minmax">
        <span class="max">▲ ${arrondi(valeurAffichage(modeles.journalier.parChamp, "temperature_2m_max", 0))}°</span>
        <span class="min">▼ ${arrondi(valeurAffichage(modeles.journalier.parChamp, "temperature_2m_min", 0))}°</span>
      </div>
      ${pastilleConfiance(confHoraire)}
      <div class="ma-stats">
        ${statHtml("droplet", "Humidité", `${arrondi(actuel.relative_humidity_2m)}%`)}
        ${statHtml("wind", "Vent", `${arrondi(actuel.wind_speed_10m)} km/h`)}
        ${statHtml("gust", "Rafales", `${arrondi(actuel.wind_gusts_10m)} km/h`)}
        ${statHtml("gauge", "Pression", `${arrondi(actuel.surface_pressure)} hPa`)}
      </div>
    </section>

    <section class="ma-section">
      <div class="ma-section-titre">Prochaines heures</div>
      <div class="ma-horaires" id="ma-horaires"></div>
    </section>

    <section class="ma-section">
      <div class="ma-onglets">
        <button type="button" class="ma-onglet" data-onglet="graphique">📈 Graphique</button>
        <button type="button" class="ma-onglet" data-onglet="jours">📅 7 jours</button>
        <button type="button" class="ma-onglet" data-onglet="modeles">🔀 Modèles</button>
      </div>
      <div id="ma-onglet-contenu"></div>
    </section>
    <div class="ma-hint">Comparaison de ${MODELES.length} modèles météo · Open-Meteo</div>
  `;

  $("ma-horaires").innerHTML = modeles.horaire.temps
    .slice(iM, iM + 24)
    .map((t, k) => {
      const i = iM + k;
      const infoH = infoCode(valeurAffichage(modeles.horaire.parChamp, "weathercode", i) ?? 0, valeurAffichage(modeles.horaire.parChamp, "is_day", i) ?? 1);
      const precip = valeurAffichage(modeles.horaire.parChamp, "precipitation_probability", i);
      return `<div class="ma-heure ${k === 0 ? "maintenant" : ""}">
        <div class="h">${k === 0 ? "Maint." : heureCourte(t)}</div>
        ${icone(infoH.icone, 26)}
        <div class="t">${arrondi(valeurAffichage(modeles.horaire.parChamp, "temperature_2m", i))}°</div>
        ${Number.isFinite(precip) ? `<div class="p">💧${arrondi(precip)}%</div>` : ""}
      </div>`;
    })
    .join("");

  document.querySelectorAll(".ma-onglet").forEach((b) => b.addEventListener("click", () => basculerOnglet(b.dataset.onglet)));
  $("ma-confiance-pill").addEventListener("click", () => basculerOnglet("modeles"));
  basculerOnglet(onglet);
}

function statHtml(nom, label, valeur) {
  const chemins = {
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    wind: '<path d="M3 8h11a2.5 2.5 0 1 0-2-4M3 16h14a2.5 2.5 0 1 1-2 4M3 12h8"/>',
    gust: '<path d="M3 7h13a2 2 0 1 0-1.6-3.2M3 12h16M3 17h10a2 2 0 1 1-1.6 3.2"/>',
    gauge: '<path d="M4 14a8 8 0 1 1 16 0M12 14l4-4M12 14h.01"/>',
  };
  return `<div class="ma-stat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${chemins[nom]}</svg><span class="val">${valeur}</span><span class="lbl">${label}</span></div>`;
}

function basculerOnglet(nom) {
  onglet = nom;
  document.querySelectorAll(".ma-onglet").forEach((b) => b.classList.toggle("actif", b.dataset.onglet === nom));
  const c = $("ma-onglet-contenu");
  if (!etatCourant) return;
  if (nom === "graphique") c.innerHTML = rendreGraphique(etatCourant);
  if (nom === "jours") c.innerHTML = rendreJours(etatCourant);
  if (nom === "modeles") c.innerHTML = rendreModeles(etatCourant);
  if (nom === "graphique") cablerChipsGraphique();
}

const METRIQUES = {
  temperature_2m: { label: "Température", unite: "°", couleur: "#ffc857" },
  precipitation_probability: { label: "Pluie", unite: "%", couleur: "#4fe0ff" },
  wind_speed_10m: { label: "Vent", unite: " km/h", couleur: "#a78bfa" },
};

function rendreGraphique(etat) {
  const { modeles } = etat;
  const iM = indexMaintenant(modeles.horaire.temps);
  const debut = Math.max(0, iM - 3);
  const fin = Math.min(modeles.horaire.temps.length, debut + 36);
  const temps = modeles.horaire.temps.slice(debut, fin);
  const valeurs = temps.map((_, k) => valeurAffichage(modeles.horaire.parChamp, metriqueGraphique, debut + k));
  const etiquettes = temps.map((t) => heureCourte(t));
  const svg = courbe({ valeurs, etiquettes, indexMaintenant: iM - debut, unite: METRIQUES[metriqueGraphique].unite, couleur: METRIQUES[metriqueGraphique].couleur, pasEtiquette: 4 });
  return `<div class="ma-carte">
    <div class="ma-chips">${Object.entries(METRIQUES).map(([c, m]) => `<button type="button" class="ma-chip ${c === metriqueGraphique ? "actif" : ""}" data-metrique="${c}">${m.label}</button>`).join("")}</div>
    ${svg}
  </div>`;
}

function cablerChipsGraphique() {
  document.querySelectorAll(".ma-chip[data-metrique]").forEach((b) =>
    b.addEventListener("click", () => {
      metriqueGraphique = b.dataset.metrique;
      basculerOnglet("graphique");
    }),
  );
}

function rendreJours(etat) {
  const { modeles } = etat;
  const j = modeles.journalier;
  const n = j.temps.length;
  const maxTemp = Math.max(...MODELES.flatMap((m) => j.parChamp.temperature_2m_max[m] || []).filter(Number.isFinite));
  const minTemp = Math.min(...MODELES.flatMap((m) => j.parChamp.temperature_2m_min[m] || []).filter(Number.isFinite));
  const ecart = maxTemp - minTemp || 1;
  let html = '<div class="ma-carte">';
  for (let i = 0; i < n; i++) {
    const code = valeurAffichage(j.parChamp, "weathercode", i) ?? 0;
    const info = infoCode(code, 1);
    const mx = valeurAffichage(j.parChamp, "temperature_2m_max", i);
    const mn = valeurAffichage(j.parChamp, "temperature_2m_min", i);
    const precip = valeurAffichage(j.parChamp, "precipitation_probability_max", i);
    const g = ((mn - minTemp) / ecart) * 100;
    const l = ((mx - mn) / ecart) * 100;
    html += `<div class="ma-jour">
      <div class="nom">${nomJour(j.temps[i], i)}<small>${dateCourte(j.temps[i])}</small></div>
      ${icone(info.icone, 26)}
      <div>
        <div class="ma-barre-temp"><i style="left:${g}%;width:${Math.max(6, l)}%"></i></div>
        <div class="ma-jour-minmax"><span class="min">${arrondi(mn)}°</span><span class="max">${arrondi(mx)}°</span></div>
      </div>
      <div class="pluie">${Number.isFinite(precip) ? `💧 ${arrondi(precip)}%` : ""}</div>
    </div>`;
  }
  html += "</div>";
  return html;
}

function rendreModeles(etat) {
  const { modeles } = etat;
  const iM = indexMaintenant(modeles.horaire.temps);
  const conf = calculerConfiance({
    tempsC: valeursModeles(modeles.horaire.parChamp, "temperature_2m", iM),
    precipPct: valeursModeles(modeles.horaire.parChamp, "precipitation_probability", iM),
    ventKmh: valeursModeles(modeles.horaire.parChamp, "wind_speed_10m", iM),
  });
  let html = `<div class="ma-carte">${MODELES.map((m) => {
    const t = modeles.horaire.parChamp.temperature_2m[m]?.[iM];
    const p = modeles.horaire.parChamp.precipitation_probability[m]?.[iM];
    const v = modeles.horaire.parChamp.wind_speed_10m[m]?.[iM];
    return `<div class="ma-modele">
      <div class="nom">${LABELS_MODELES[m]}</div>
      <div class="vals">
        <div>${arrondi(t)}°<span class="att">temp.</span></div>
        <div>${Number.isFinite(p) ? arrondi(p) + "%" : "—"}<span class="att">pluie</span></div>
        <div>${arrondi(v)}<span class="att">km/h</span></div>
      </div>
    </div>`;
  }).join("")}</div>`;
  html += `<div class="ma-carte">${detailsConfianceHtml(conf)}</div>`;
  return html;
}

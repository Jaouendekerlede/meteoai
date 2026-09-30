// Rendu de l'écran : en-tête (lieu), et 4 onglets en barre basse façon appli
// (Accueil, Graphiques, 10 jours, Réglages).

import { icone, infoCode } from "./icones-meteo.js";
import { calculerConfiance } from "./confiance.js";
import { courbe } from "./graphique.js";
import { MODELES, LABELS_MODELES, JOURS_PREVISION } from "./config.js";
import { estFavori, listerFavoris, basculerFavori } from "./storage.js";
import { MENTION_COURTE, MENTION_LEGALE, VERSION_TEXTE } from "./mentions.js";

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

function nomJourCourt(iso, i) {
  if (i === 0) return "Auj.";
  if (i === 1) return "Dem.";
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short" }).replace(/^./, (c) => c.toUpperCase()).replace(".", "");
}

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function heureHM(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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

// Même repli, pour les champs texte (sunrise/sunset : horodatage ISO, pas un nombre).
function valeurAffichageTexte(parChamp, champ, i) {
  for (const m of MODELES) {
    const v = parChamp[champ]?.[m]?.[i];
    if (v) return v;
  }
  return null;
}

function confianceHeure(modeles, i) {
  return calculerConfiance({
    tempsC: valeursModeles(modeles.horaire.parChamp, "temperature_2m", i),
    precipPct: valeursModeles(modeles.horaire.parChamp, "precipitation_probability", i),
    ventKmh: valeursModeles(modeles.horaire.parChamp, "wind_speed_10m", i),
  });
}

function confianceJour(modeles, i) {
  return calculerConfiance({
    tempsC: [...valeursModeles(modeles.journalier.parChamp, "temperature_2m_max", i), ...valeursModeles(modeles.journalier.parChamp, "temperature_2m_min", i)],
    precipPct: valeursModeles(modeles.journalier.parChamp, "precipitation_probability_max", i),
    ventKmh: valeursModeles(modeles.journalier.parChamp, "wind_speed_10m_max", i),
  });
}

export function afficherChargement() {
  $("ma-contenu").innerHTML = `<div class="ma-chargement"><div class="spin"></div>Chargement de la météo…</div>`;
  $("ma-tabbar").classList.add("hidden");
}

export function afficherErreur(message, onReessayer) {
  $("ma-tabbar").classList.add("hidden");
  $("ma-contenu").innerHTML = `<div class="ma-erreur">⚠️ ${message}<br><button type="button" id="ma-reessayer-btn">Réessayer</button></div>`;
  $("ma-reessayer-btn").addEventListener("click", onReessayer);
}

// ── Anneau de confiance (SVG) ────────────────────────────────────────────

const R_ANNEAU = 15.5;
const CIRC_ANNEAU = 2 * Math.PI * R_ANNEAU;

function anneauConfiance(conf, taille = 52) {
  const couleur = { haute: "var(--vert)", moyenne: "var(--orange)", basse: "var(--rouge)" }[conf.niveau];
  const trace = (conf.score / 100) * CIRC_ANNEAU;
  return `<div class="ma-anneau-wrap" style="width:${taille}px;height:${taille}px">
    <svg viewBox="0 0 36 36" width="${taille}" height="${taille}">
      <circle cx="18" cy="18" r="${R_ANNEAU}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3.2"/>
      <circle cx="18" cy="18" r="${R_ANNEAU}" fill="none" stroke="${couleur}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="${trace} ${CIRC_ANNEAU}" transform="rotate(-90 18 18)"/>
    </svg>
    <span class="ma-anneau-val">${conf.score}</span>
  </div>`;
}

const LABEL_NIVEAU = { haute: "Confiance élevée", moyenne: "Confiance moyenne", basse: "Confiance faible" };

function carteConfiance(conf, modeles, i, cle) {
  return `<div class="ma-carte ma-conf-carte">
    <button type="button" class="ma-conf-ligne" data-conf-toggle="${cle}">
      ${anneauConfiance(conf)}
      <div class="ma-conf-texte"><b>${LABEL_NIVEAU[conf.niveau]}</b><span>${conf.texte}</span></div>
      <span class="ma-chevron-down">⌄</span>
    </button>
    <div class="ma-conf-detail hidden" id="ma-conf-detail-${cle}">
      <div class="ma-details-confiance">${conf.details
        .map((d) => `<div class="ma-detail ${d.points > 0 ? "bon" : d.points < 0 ? "mauvais" : "neutre"}">${d.points > 0 ? "✅" : d.points < 0 ? "⚠️" : "•"} <span>${d.label}</span></div>`)
        .join("")}</div>
      <div class="ma-conf-modeles">${MODELES.map((m) => {
        const t = modeles.horaire.parChamp.temperature_2m[m]?.[i];
        const p = modeles.horaire.parChamp.precipitation_probability[m]?.[i];
        const v = modeles.horaire.parChamp.wind_speed_10m[m]?.[i];
        return `<div class="ma-modele">
          <div class="nom">${LABELS_MODELES[m]}</div>
          <div class="vals">
            <div>${arrondi(t)}°<span class="att">temp.</span></div>
            <div>${Number.isFinite(p) ? arrondi(p) + "%" : "—"}<span class="att">pluie</span></div>
            <div>${arrondi(v)}<span class="att">km/h</span></div>
          </div>
        </div>`;
      }).join("")}</div>
    </div>
  </div>`;
}

function cablerConfiance() {
  document.querySelectorAll("[data-conf-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const detail = $(`ma-conf-detail-${btn.dataset.confToggle}`);
      detail.classList.toggle("hidden");
      btn.classList.toggle("ouvert", !detail.classList.contains("hidden"));
    }),
  );
}

// ── État & navigation par onglets ────────────────────────────────────────

let onglet = "accueil";
let metriqueGraphique = "temperature_2m";
let etatCourant = null;

export function afficherMeteo(etat) {
  etatCourant = etat;
  $("ma-lieu-nom").textContent = etat.lieu.nom;
  $("ma-lieu-admin").textContent = etat.lieu.viaGPS ? "Votre position actuelle" : etat.lieu.admin || "";
  majFavoriBtn(etat.lieu);
  $("ma-tabbar").classList.remove("hidden");
  afficherOnglet(onglet);
}

function majFavoriBtn(lieu) {
  const actif = estFavori(lieu.nom, lieu.lat, lieu.lon);
  $("ma-favori-btn").textContent = actif ? "★" : "☆";
  $("ma-favori-btn").classList.toggle("actif", actif);
}

function cablerTabbar() {
  document.querySelectorAll(".ma-tab").forEach((b) => b.addEventListener("click", () => afficherOnglet(b.dataset.tab)));
}
cablerTabbar();

function afficherOnglet(nom) {
  onglet = nom;
  document.querySelectorAll(".ma-tab").forEach((b) => b.classList.toggle("actif", b.dataset.tab === nom));
  if (!etatCourant) return;
  const c = $("ma-contenu");
  if (nom === "accueil") c.innerHTML = rendreAccueil(etatCourant);
  if (nom === "graphiques") c.innerHTML = rendreGraphiques(etatCourant);
  if (nom === "jours") c.innerHTML = rendreJoursComplet(etatCourant);
  if (nom === "reglages") c.innerHTML = rendreReglages(etatCourant);
  cablerConfiance();
  if (nom === "accueil") $("ma-voir-tout-btn")?.addEventListener("click", () => afficherOnglet("jours"));
  if (nom === "graphiques") cablerChipsGraphique();
  if (nom === "reglages") cablerReglages();
}

// ── Icônes des statistiques ──────────────────────────────────────────────

function statHtml(nom, label, valeur, sousLigne = "") {
  const chemins = {
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    wind: '<path d="M3 8h11a2.5 2.5 0 1 0-2-4M3 16h14a2.5 2.5 0 1 1-2 4M3 12h8"/>',
    gauge: '<path d="M4 14a8 8 0 1 1 16 0M12 14l4-4M12 14h.01"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8"/>',
  };
  return `<div class="ma-stat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${chemins[nom]}</svg><span class="val">${valeur}</span><span class="lbl">${label}</span>${sousLigne ? `<span class="sous">${sousLigne}</span>` : ""}</div>`;
}

function uvTexte(uv) {
  if (!Number.isFinite(uv)) return "—";
  if (uv < 3) return "Faible";
  if (uv < 6) return "Modéré";
  if (uv < 8) return "Élevé";
  if (uv < 11) return "Très élevé";
  return "Extrême";
}

// ── Onglet Accueil ───────────────────────────────────────────────────────

function rendreAccueil(etat) {
  const { actuel, modeles } = etat;
  const iM = indexMaintenant(modeles.horaire.temps);
  const info = infoCode(actuel.weathercode, actuel.is_day);
  const conf = confianceHeure(modeles, iM);
  const j = modeles.journalier;

  const html = `
    <section class="ma-hero ${actuel.is_day === 0 ? "nuit" : ""}">
      <div class="ma-hero-top">
        <div>
          <div class="ma-temp">${arrondi(actuel.temperature_2m)}<sup>°</sup></div>
          <div class="ma-hero-desc">${info.texte}</div>
          <div class="ma-hero-ressenti">Ressenti ${arrondi(actuel.apparent_temperature)}°</div>
        </div>
        <div class="ma-hero-icone">${icone(info.icone, 84)}</div>
      </div>
      <div class="ma-hero-minmax">
        <span class="max">▲ ${arrondi(valeurAffichage(j.parChamp, "temperature_2m_max", 0))}°</span>
        <span class="min">▼ ${arrondi(valeurAffichage(j.parChamp, "temperature_2m_min", 0))}°</span>
      </div>
      <div class="ma-stats">
        ${statHtml("droplet", "Pluie", `${arrondi(valeurAffichage(modeles.horaire.parChamp, "precipitation_probability", iM))}%`)}
        ${statHtml("wind", "Vent", `${arrondi(actuel.wind_speed_10m)} km/h`, `Rafales ${arrondi(actuel.wind_gusts_10m)}`)}
        ${statHtml("droplet", "Humidité", `${arrondi(actuel.relative_humidity_2m)}%`)}
        ${statHtml("gauge", "Pression", `${arrondi(actuel.surface_pressure)}`, "hPa")}
        ${statHtml("sun", "Indice UV", uvTexte(valeurAffichage(modeles.horaire.parChamp, "uv_index", iM)))}
      </div>
    </section>

    ${carteConfiance(conf, modeles, iM, "accueil")}

    <section class="ma-section">
      <div class="ma-section-titre">Prochaines heures</div>
      <div class="ma-horaires">${rendreHoraires(modeles, iM)}</div>
    </section>

    <section class="ma-section">
      <div class="ma-section-titre-ligne">
        <div class="ma-section-titre">Prévisions sur ${JOURS_PREVISION} jours</div>
        <button type="button" class="ma-voir-tout" id="ma-voir-tout-btn">Voir tout ›</button>
      </div>
      <div class="ma-jours-scroll">${j.temps.map((_, i) => carteJour(modeles, i, true)).join("")}</div>
    </section>

    ${carteSoleil(j)}

    <div class="ma-hint">Comparaison de ${MODELES.length} modèles météo · Open-Meteo</div>
  `;
  return html;
}

function rendreHoraires(modeles, iM) {
  return modeles.horaire.temps
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
}

function carteSoleil(j) {
  const lever = valeurAffichageTexte(j.parChamp, "sunrise", 0);
  const coucher = valeurAffichageTexte(j.parChamp, "sunset", 0);
  if (!lever || !coucher) return "";
  return `<section class="ma-carte ma-soleil">
    <div class="ma-soleil-icone">${icone("soleil", 30)}</div>
    <div class="ma-soleil-texte">
      <b>Lever du soleil</b>
      <span>${heureHM(lever)}</span>
    </div>
    <div class="ma-soleil-sep"></div>
    <div class="ma-soleil-texte">
      <b>Coucher du soleil</b>
      <span>${heureHM(coucher)}</span>
    </div>
  </section>`;
}

// ── Carte "jour" (réutilisée en aperçu compact et en liste complète) ─────

function carteJour(modeles, i, compact) {
  const j = modeles.journalier;
  const code = valeurAffichage(j.parChamp, "weathercode", i) ?? 0;
  const info = infoCode(code, 1);
  const mx = valeurAffichage(j.parChamp, "temperature_2m_max", i);
  const mn = valeurAffichage(j.parChamp, "temperature_2m_min", i);
  const precipMm = valeurAffichage(j.parChamp, "precipitation_sum", i);
  const precipPct = valeurAffichage(j.parChamp, "precipitation_probability_max", i);
  const vent = valeurAffichage(j.parChamp, "wind_speed_10m_max", i);
  const conf = confianceJour(modeles, i);
  const couleurConf = { haute: "var(--vert)", moyenne: "var(--orange)", basse: "var(--rouge)" }[conf.niveau];

  if (compact) {
    return `<div class="ma-carte-jour">
      <b>${nomJourCourt(j.temps[i], i)}</b>
      ${icone(info.icone, 30)}
      <div class="mm"><span class="max">${arrondi(mx)}°</span> <span class="min">${arrondi(mn)}°</span></div>
      <div class="ma-carte-jour-pluie">💧 ${Number.isFinite(precipMm) ? precipMm.toFixed(1) : "0"} mm</div>
      <div class="ma-carte-jour-conf" style="color:${couleurConf}">● ${conf.score}/100</div>
    </div>`;
  }

  return `<div class="ma-carte">
    <button type="button" class="ma-jour-ligne" data-conf-toggle="jour${i}">
      <div class="ma-jour-nom">${nomJour(j.temps[i], i)}<small>${dateCourte(j.temps[i])}</small></div>
      ${icone(info.icone, 30)}
      <div class="ma-jour-chiffres">
        <div class="ma-jour-minmax"><span class="max">${arrondi(mx)}°</span> <span class="min">${arrondi(mn)}°</span></div>
        <div class="ma-jour-sous">💧 ${Number.isFinite(precipPct) ? arrondi(precipPct) + "%" : "—"} · ${Number.isFinite(precipMm) ? precipMm.toFixed(1) : "0"} mm · 💨 ${arrondi(vent)} km/h</div>
      </div>
      <div class="ma-conf-mini" style="color:${couleurConf}">${conf.score}</div>
    </button>
    <div class="ma-conf-detail hidden" id="ma-conf-detail-jour${i}">
      <div class="ma-details-confiance">${conf.details.map((d) => `<div class="ma-detail ${d.points > 0 ? "bon" : d.points < 0 ? "mauvais" : "neutre"}">${d.points > 0 ? "✅" : d.points < 0 ? "⚠️" : "•"} <span>${d.label}</span></div>`).join("")}</div>
    </div>
  </div>`;
}

function rendreJoursComplet(etat) {
  const { modeles } = etat;
  return `<section class="ma-section">${modeles.journalier.temps.map((_, i) => carteJour(modeles, i, false)).join("")}</section>`;
}

// ── Onglet Graphiques ────────────────────────────────────────────────────

const METRIQUES = {
  temperature_2m: { label: "Température", unite: "°", couleur: "#ffc857" },
  precipitation_probability: { label: "Pluie", unite: "%", couleur: "#4fe0ff" },
  wind_speed_10m: { label: "Vent", unite: " km/h", couleur: "#a78bfa" },
  wind_gusts_10m: { label: "Rafales", unite: " km/h", couleur: "#ff8fa3" },
};

function rendreGraphiques(etat) {
  const { modeles } = etat;
  const iM = indexMaintenant(modeles.horaire.temps);
  const debut = Math.max(0, iM - 3);
  const fin = Math.min(modeles.horaire.temps.length, debut + 36);
  const temps = modeles.horaire.temps.slice(debut, fin);
  const valeurs = temps.map((_, k) => valeurAffichage(modeles.horaire.parChamp, metriqueGraphique, debut + k));
  const etiquettes = temps.map((t) => heureCourte(t));
  const svg = courbe({ valeurs, etiquettes, indexMaintenant: iM - debut, unite: METRIQUES[metriqueGraphique].unite, couleur: METRIQUES[metriqueGraphique].couleur, pasEtiquette: 4 });
  return `<section class="ma-section">
    <div class="ma-carte">
      <div class="ma-chips">${Object.entries(METRIQUES).map(([c, m]) => `<button type="button" class="ma-chip ${c === metriqueGraphique ? "actif" : ""}" data-metrique="${c}">${m.label}</button>`).join("")}</div>
      ${svg}
    </div>
  </section>`;
}

function cablerChipsGraphique() {
  document.querySelectorAll(".ma-chip[data-metrique]").forEach((b) =>
    b.addEventListener("click", () => {
      metriqueGraphique = b.dataset.metrique;
      afficherOnglet("graphiques");
    }),
  );
}

// ── Onglet Réglages ──────────────────────────────────────────────────────

function rendreReglages(etat) {
  const favoris = listerFavoris();
  return `<section class="ma-section">
    <div class="ma-section-titre">Favoris</div>
    <div class="ma-carte">${
      favoris.length
        ? favoris.map((f, i) => `<div class="ma-favori" data-reg-fav="${i}"><div><div class="nom">${f.nom}</div><div class="admin">${f.admin || ""}</div></div><button type="button" class="ma-favori-etoile" data-reg-fav-retirer="${i}">★</button></div>`).join("")
        : `<div class="ma-hint" style="padding:16px 0">Aucune ville favorite pour l'instant. Touchez l'étoile en haut pour en ajouter.</div>`
    }</div>

    <div class="ma-section-titre">À venir</div>
    <div class="ma-carte">
      <div class="ma-avenir">🗺️ <div><b>Carte météo</b><span>Pluie, nuages et vent sur une carte, avec curseur temporel.</span></div></div>
      <div class="ma-avenir">🤖 <div><b>Assistant IA</b><span>Poser une question sur la météo à venir, en langage naturel.</span></div></div>
      <div class="ma-avenir">🚗 <div><b>Météo sur trajet + mode véhicule électrique</b><span>Impact de la météo sur l'autonomie, pensé pour ta Kona Electric.</span></div></div>
    </div>

    <div class="ma-carte">
      <details><summary>⚖️ Mentions légales</summary><p class="ma-hint" style="text-align:left;margin-top:8px">${MENTION_LEGALE}</p></details>
    </div>

    <div class="ma-hint">Météo AI · données Open-Meteo (${MODELES.length} modèles) · sans compte, sans clé</div>
    <div class="ma-hint">${MENTION_COURTE}</div>
    <div class="ma-hint">${VERSION_TEXTE}</div>
  </section>`;
}

function cablerReglages() {
  document.querySelectorAll("[data-reg-fav]").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-reg-fav-retirer]")) return;
      const f = listerFavoris()[Number(el.dataset.regFav)];
      window.dispatchEvent(new CustomEvent("ma-aller-a", { detail: f }));
    }),
  );
  document.querySelectorAll("[data-reg-fav-retirer]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const f = listerFavoris()[Number(btn.dataset.regFavRetirer)];
      basculerFavori(f.nom, f.lat, f.lon, f.admin);
      if (etatCourant) majFavoriBtn(etatCourant.lieu);
      afficherOnglet("reglages");
    }),
  );
}

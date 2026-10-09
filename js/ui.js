// Rendu de l'écran : en-tête (lieu), et 4 onglets en barre basse façon appli
// (Accueil, Graphiques, 10 jours, Réglages).

import { icone, infoCode } from "./icones-meteo.js";
import { calculerConfiance, poidsModeles } from "./confiance.js";
import { courbe, courbeCombinee, courbeMultiple } from "./graphique.js";
import { MODELES, LABELS_MODELES, JOURS_PREVISION } from "./config.js";
import { estFavori, listerFavoris, basculerFavori, lireReglages, listerVoyages, ajouterVoyage, retirerVoyage } from "./storage.js";
import { rechercherVille } from "./geo.js";
import { MENTION_COURTE, MENTION_LEGALE, VERSION_TEXTE } from "./mentions.js";
import { categoriePrecip } from "./theme-meteo.js";
import { releveVeille } from "./historique.js";
import { creerLienSauvegarde } from "./restauration.js";
import { initRadar, redimensionner, allerFrame, jouerPause, arreterLecture, infosFrame } from "./radar.js";
import { valeursModeles, valeurAffichage, valeurAffichageTexte, valeurInterpolee, indexMaintenant } from "./donnees-modeles.js";
import { calculerAlertes } from "./alertes-meteo.js";

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

const NOMS_MODELES = Object.values(LABELS_MODELES);

function confianceHeure(modeles, i) {
  const poids = poidsModeles(MODELES.length, 0); // toujours "maintenant" pour cet usage
  return calculerConfiance({
    tempsC: valeursModeles(modeles.horaire.parChamp, "temperature_2m", i),
    precipPct: valeursModeles(modeles.horaire.parChamp, "precipitation_probability", i),
    ventKmh: valeursModeles(modeles.horaire.parChamp, "wind_speed_10m", i),
    labelsModeles: NOMS_MODELES,
    poids,
  });
}

function confianceJour(modeles, i) {
  const poids = poidsModeles(MODELES.length, i * 24);
  return calculerConfiance({
    tempsC: [...valeursModeles(modeles.journalier.parChamp, "temperature_2m_max", i), ...valeursModeles(modeles.journalier.parChamp, "temperature_2m_min", i)],
    precipPct: valeursModeles(modeles.journalier.parChamp, "precipitation_probability_max", i),
    ventKmh: valeursModeles(modeles.journalier.parChamp, "wind_speed_10m_max", i),
    labelsModeles: [...NOMS_MODELES, ...NOMS_MODELES],
    poids: [...poids, ...poids],
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

function sousScoreHtml(label, score) {
  const couleur = score >= 75 ? "var(--vert)" : score >= 50 ? "var(--orange)" : "var(--rouge)";
  return `<div class="ma-sous-score"><span class="lbl">${label}</span><span class="val" style="color:${couleur}">${score}</span></div>`;
}

function carteConfiance(conf, modeles, i, cle) {
  return `<div class="ma-carte ma-conf-carte">
    <button type="button" class="ma-conf-ligne" data-conf-toggle="${cle}">
      ${anneauConfiance(conf)}
      <div class="ma-conf-texte"><b>${LABEL_NIVEAU[conf.niveau]}</b><span>${conf.texte}</span></div>
      <span class="ma-chevron-down">⌄</span>
    </button>
    <div class="ma-conf-detail hidden" id="ma-conf-detail-${cle}">
      <div class="ma-sous-scores">
        ${sousScoreHtml("Température", conf.sousScores.temperature)}
        ${sousScoreHtml("Pluie", conf.sousScores.pluie)}
        ${conf.sousScores.vent !== null ? sousScoreHtml("Vent", conf.sousScores.vent) : ""}
      </div>
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
let comparerModeles = false;
let etatCourant = null;
const COULEURS_MODELES = ["#4fe0ff", "#ffc857", "#a78bfa", "#ff8fa3"];

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

// Écouteur unique (posé une seule fois, pas à chaque rendu de Réglages) :
// le bouton lui-même est recréé à chaque rendu, mais "window" ne l'est pas.
window.addEventListener("ma-notifications-retour", (e) => {
  const retour = $("ma-notif-retour");
  const bouton = $("ma-notif-btn");
  if (!retour || !bouton) return;
  retour.style.display = "block";
  retour.textContent =
    e.detail === "granted" ? "✅ Alertes activées." : e.detail === "denied" ? "⚠️ Notifications refusées." : "Notifications non supportées par ce navigateur.";
  bouton.textContent = texteBoutonNotif();
});

function afficherOnglet(nom) {
  const precedent = onglet;
  onglet = nom;
  document.querySelectorAll(".ma-tab").forEach((b) => b.classList.toggle("actif", b.dataset.tab === nom));
  if (!etatCourant) return;
  if (precedent === "carte" && nom !== "carte") arreterLecture();
  const c = $("ma-contenu");
  if (nom === "accueil") c.innerHTML = rendreAccueil(etatCourant);
  if (nom === "graphiques") c.innerHTML = rendreGraphiques(etatCourant);
  if (nom === "jours") c.innerHTML = rendreJoursComplet(etatCourant);
  if (nom === "reglages") c.innerHTML = rendreReglages(etatCourant);
  if (nom === "carte") c.innerHTML = rendreCarte();
  cablerConfiance();
  if (nom === "accueil") {
    $("ma-voir-tout-btn")?.addEventListener("click", () => afficherOnglet("jours"));
    animerNombres();
  }
  if (nom === "graphiques") cablerChipsGraphique();
  if (nom === "reglages") cablerReglages();
  if (nom === "carte") cablerCarte();
}

// ── Onglet Carte (radar de précipitations) ──────────────────────────────

function rendreCarte() {
  return `<section class="ma-section ma-carte-section">
    <div class="ma-carte" style="padding:0;overflow:hidden">
      <div id="ma-radar-conteneur" class="ma-radar-conteneur"><div class="ma-radar-chargement">Chargement du radar…</div></div>
      <div class="ma-radar-controles">
        <button type="button" class="ma-icone-btn" id="ma-radar-jouer" title="Lecture">▶️</button>
        <input type="range" id="ma-radar-curseur" min="0" max="1" value="0" step="1">
        <span class="ma-radar-heure" id="ma-radar-heure">--:--</span>
      </div>
    </div>
    <div class="ma-hint">Radar RainViewer · pluie observée (dernière heure) + prévision à très court terme</div>
  </section>`;
}

function cablerCarte() {
  const lieu = etatCourant.lieu;
  initRadar("ma-radar-conteneur", lieu.lat, lieu.lon, (infos) => {
    $("ma-radar-curseur").max = String(Math.max(0, infos.total - 1));
    $("ma-radar-curseur").value = String(infos.index);
    $("ma-radar-heure").textContent = infos.prevision ? `${infos.texte} (prévision)` : infos.texte;
  }).catch((e) => {
    $("ma-radar-conteneur").innerHTML = `<div class="ma-radar-chargement">⚠️ ${e.message}</div>`;
  });

  $("ma-radar-curseur").addEventListener("input", (e) => {
    arreterLecture();
    $("ma-radar-jouer").textContent = "▶️";
    allerFrame(Number(e.target.value));
    const infos = infosFrame();
    $("ma-radar-heure").textContent = infos.prevision ? `${infos.texte} (prévision)` : infos.texte;
  });
  $("ma-radar-jouer").addEventListener("click", () => {
    const lecture = jouerPause();
    $("ma-radar-jouer").textContent = lecture ? "⏸️" : "▶️";
  });
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

function overlayPrecip(categorie) {
  if (!categorie) return "";
  const n = categorie === "neige" ? 18 : 26;
  const elements = Array.from({ length: n }, () => {
    const gauche = Math.random() * 100;
    const duree = (categorie === "neige" ? 3 + Math.random() * 2.5 : 0.6 + Math.random() * 0.5).toFixed(2);
    const delai = (Math.random() * 3).toFixed(2);
    const style = `left:${gauche.toFixed(1)}%;animation-duration:${duree}s;animation-delay:${delai}s${categorie === "neige" ? `;--derive:${(Math.random() * 40 - 20).toFixed(0)}px` : ""}`;
    return `<span class="${categorie === "neige" ? "ma-flocon" : "ma-goutte"}" style="${style}"></span>`;
  }).join("");
  return `<div class="ma-precip-overlay">${elements}</div>`;
}

// Anime un grand chiffre entier de 0 jusqu'à sa cible (data-cible), utilisé
// pour le "compteur" de température. Ignore le signe (peut être négatif) en
// interpolant la valeur affichée.
function animerNombres() {
  document.querySelectorAll(".ma-temp[data-cible]").forEach((el) => {
    const cible = Number(el.dataset.cible);
    const duree = 700;
    const debut = performance.now();
    function etape(t) {
      const p = Math.max(0, Math.min(1, (t - debut) / duree));
      const v = Math.round(cible * (1 - Math.pow(1 - p, 3))); // easeOutCubic
      el.firstChild.textContent = String(v);
      if (p < 1) requestAnimationFrame(etape);
    }
    requestAnimationFrame(etape);
  });
}

function uvTexte(uv) {
  if (!Number.isFinite(uv)) return "—";
  if (uv < 3) return "Faible";
  if (uv < 6) return "Modéré";
  if (uv < 8) return "Élevé";
  if (uv < 11) return "Très élevé";
  return "Extrême";
}

function rendreAlertes(alertes) {
  if (!alertes.length) return "";
  return `<section class="ma-alertes">${alertes.map((a) => `<div class="ma-alerte ma-alerte-${a.niveau}"><span class="ic">${a.icone}</span><span>${a.texte}</span></div>`).join("")}</section>`;
}

// Ligne de résumé des précipitations sous le bloc principal, façon Google
// Weather ("No precipitation expected for the next hour" / "Rain starting
// around 14:00") -- regarde les 3 prochaines heures.
function rendrePrecipResume(modeles, iM) {
  const fenetre = modeles.horaire.temps.slice(iM, iM + 3).map((_, k) => valeurAffichage(modeles.horaire.parChamp, "precipitation_probability", iM + k));
  const seuil = fenetre.findIndex((p) => Number.isFinite(p) && p >= 50);
  if (seuil === -1) return `<div class="ma-precip-ligne"><span class="ic">💧</span>Aucune précipitation prévue dans les prochaines heures.</div>`;
  if (seuil === 0) return `<div class="ma-precip-ligne"><span class="ic">💧</span>Précipitations probables actuellement.</div>`;
  return `<div class="ma-precip-ligne"><span class="ic">💧</span>Précipitations probables vers ${heureCourte(modeles.horaire.temps[iM + seuil])}.</div>`;
}

// Min/max de toute la période affichée (pas seulement du jour) -- sert à
// positionner la barre de plage de chaque jour dans la liste "10 jours",
// comme Google Weather (chaque jour se lit par rapport à la semaine).
function plageTemperaturesPeriode(modeles) {
  const j = modeles.journalier;
  let min = Infinity;
  let max = -Infinity;
  j.temps.forEach((_, i) => {
    const mn = valeurAffichage(j.parChamp, "temperature_2m_min", i);
    const mx = valeurAffichage(j.parChamp, "temperature_2m_max", i);
    if (Number.isFinite(mn)) min = Math.min(min, mn);
    if (Number.isFinite(mx)) max = Math.max(max, mx);
  });
  return { min, max };
}

// ── Onglet Accueil ───────────────────────────────────────────────────────

function rendreAccueil(etat) {
  const { actuel, modeles } = etat;
  const iM = indexMaintenant(modeles.horaire.temps);
  const info = infoCode(actuel.weathercode, actuel.is_day);
  const conf = confianceHeure(modeles, iM);
  const j = modeles.journalier;

  const veille = releveVeille(etat.lieu);
  const alertes = calculerAlertes({ actuel, modeles, iM, conf });
  const html = `
    ${rendreAlertes(alertes)}

    <section class="ma-hero ${actuel.is_day === 0 ? "nuit" : ""}">
      ${overlayPrecip(categoriePrecip(actuel.weathercode))}
      <div class="ma-hero-top">
        <div>
          <div class="ma-temp" data-cible="${Math.round(actuel.temperature_2m)}">0<sup>°</sup></div>
          <div class="ma-hero-desc">${info.texte}</div>
          <div class="ma-hero-ressenti">Ressenti ${arrondi(actuel.apparent_temperature)}°${veille ? ` · ${veille.temp}° hier à ${veille.heure}h ici` : ""}</div>
        </div>
        <div class="ma-hero-icone">${icone(info.icone, 84)}</div>
      </div>
      <div class="ma-hero-minmax">
        <span class="max">▲ ${arrondi(valeurAffichage(j.parChamp, "temperature_2m_max", 0))}°</span>
        <span class="min">▼ ${arrondi(valeurAffichage(j.parChamp, "temperature_2m_min", 0))}°</span>
      </div>
    </section>
    ${rendrePrecipResume(modeles, iM)}

    ${carteConfiance(conf, modeles, iM, "accueil")}

    <section class="ma-section">
      <div class="ma-section-titre">Prochaines heures</div>
      <div class="ma-carte ma-carte-horaires"><div class="ma-horaires">${rendreHoraires(modeles, iM)}</div></div>
    </section>

    <section class="ma-section">
      <div class="ma-section-titre-ligne">
        <div class="ma-section-titre">Prévisions sur ${JOURS_PREVISION} jours</div>
        <button type="button" class="ma-voir-tout" id="ma-voir-tout-btn">Voir tout ›</button>
      </div>
      <div class="ma-jours-scroll">${j.temps.map((_, i) => carteJour(modeles, i, true)).join("")}</div>
    </section>

    ${carteSoleil(j)}

    <section class="ma-section">
      <div class="ma-section-titre">Détails</div>
      <div class="ma-stats">
        ${statHtml("droplet", "Précipitations", `${arrondi(valeurInterpolee(modeles.horaire, "precipitation_probability"))}%`)}
        ${statHtml("wind", "Vent", `${arrondi(actuel.wind_speed_10m)} km/h`, `Rafales ${arrondi(actuel.wind_gusts_10m)} km/h`)}
        ${statHtml("droplet", "Humidité", `${arrondi(actuel.relative_humidity_2m)}%`)}
        ${statHtml("gauge", "Pression", `${arrondi(actuel.surface_pressure)} hPa`)}
        ${statHtml("sun", "Indice UV", uvTexte(valeurInterpolee(modeles.horaire, "uv_index")))}
      </div>
    </section>

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
        <div class="h">${k === 0 ? '<span class="ma-point-direct"></span>Maint.' : heureCourte(t)}</div>
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
  const tLever = new Date(lever).getTime();
  const tCoucher = new Date(coucher).getTime();
  const fraction = Math.max(0, Math.min(1, (Date.now() - tLever) / (tCoucher - tLever)));
  return `<section class="ma-carte">
    <div class="ma-soleil">
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
    </div>
    <div class="ma-jour-barre"><i style="width:${(fraction * 100).toFixed(1)}%"></i><div class="curseur" style="left:${(fraction * 100).toFixed(1)}%"></div></div>
    <div class="ma-jour-heures"><span>${heureHM(lever)}</span><span>${heureHM(coucher)}</span></div>
  </section>`;
}

// ── Carte "jour" (réutilisée en aperçu compact et en liste complète) ─────

function carteJour(modeles, i, compact, plage) {
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

  // Barre de plage min/max positionnée dans l'étendue de toute la période
  // affichée (ex: 0°..22° sur 10 jours) -- comme Google Weather, chaque
  // jour se lit par rapport au reste de la semaine, pas isolément.
  let barre = "";
  if (plage && Number.isFinite(mn) && Number.isFinite(mx) && plage.max > plage.min) {
    const etendue = plage.max - plage.min;
    const gauche = ((mn - plage.min) / etendue) * 100;
    const largeur = Math.max(6, ((mx - mn) / etendue) * 100);
    barre = `<div class="ma-temp-range"><i style="left:${gauche.toFixed(1)}%;width:${largeur.toFixed(1)}%"></i></div>`;
  }

  return `<div class="ma-carte">
    <button type="button" class="ma-jour-ligne" data-conf-toggle="jour${i}">
      <div class="ma-jour-nom">${nomJour(j.temps[i], i)}<small>${dateCourte(j.temps[i])}</small></div>
      ${icone(info.icone, 30)}
      <div class="ma-jour-chiffres">
        <div class="ma-jour-minmax"><span class="min">${arrondi(mn)}°</span>${barre || "<span style=\"flex:1\"></span>"}<span class="max">${arrondi(mx)}°</span></div>
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
  const plage = plageTemperaturesPeriode(modeles);
  return `<section class="ma-section">${modeles.journalier.temps.map((_, i) => carteJour(modeles, i, false, plage)).join("")}</section>`;
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
  const etiquettes = temps.map((t) => heureCourte(t));
  const m = METRIQUES[metriqueGraphique];

  let svg;
  if (comparerModeles) {
    const series = MODELES.map((mod, k) => ({
      valeurs: temps.map((_, i) => modeles.horaire.parChamp[metriqueGraphique]?.[mod]?.[debut + i]),
      couleur: COULEURS_MODELES[k],
    }));
    svg = courbeMultiple({ series, etiquettes, indexMaintenant: iM - debut, unite: m.unite, pasEtiquette: 4 });
  } else if (metriqueGraphique === "temperature_2m") {
    const temperatures = temps.map((_, k) => valeurAffichage(modeles.horaire.parChamp, "temperature_2m", debut + k));
    const precipitations = temps.map((_, k) => valeurAffichage(modeles.horaire.parChamp, "precipitation", debut + k));
    svg = courbeCombinee({ temperatures, precipitations, etiquettes, indexMaintenant: iM - debut, pasEtiquette: 4 });
  } else {
    const valeurs = temps.map((_, k) => valeurAffichage(modeles.horaire.parChamp, metriqueGraphique, debut + k));
    svg = courbe({ valeurs, etiquettes, indexMaintenant: iM - debut, unite: m.unite, couleur: m.couleur, pasEtiquette: 4 });
  }

  return `<section class="ma-section">
    <div class="ma-carte">
      <div class="ma-chips">${Object.entries(METRIQUES).map(([c, mm]) => `<button type="button" class="ma-chip ${c === metriqueGraphique ? "actif" : ""}" data-metrique="${c}">${mm.label}</button>`).join("")}</div>
      ${svg}
      ${!comparerModeles && metriqueGraphique === "temperature_2m" ? `<div class="ma-hint" style="margin-top:2px">🟡 Température · 🔵 Pluie (mm)</div>` : ""}
      ${comparerModeles ? `<div class="ma-legende-modeles">${MODELES.map((mod, k) => `<span><i style="background:${COULEURS_MODELES[k]}"></i>${LABELS_MODELES[mod]}</span>`).join("")}</div>` : ""}
      <button type="button" class="ma-chip" id="ma-comparer-btn" style="margin-top:10px">${comparerModeles ? "↩ Revenir à la vue simple" : "🔀 Comparer les 4 modèles"}</button>
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
  $("ma-comparer-btn")?.addEventListener("click", () => {
    comparerModeles = !comparerModeles;
    afficherOnglet("graphiques");
  });
}

// ── Onglet Réglages ──────────────────────────────────────────────────────

function joursRestants(dateStr) {
  const j = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (j < 0) return "Passé";
  if (j === 0) return "Aujourd'hui";
  if (j === 1) return "Demain";
  return `J-${j}`;
}

function texteBoutonNotif() {
  if (typeof Notification === "undefined") return "🔕 Notifications non supportées par ce navigateur";
  if (Notification.permission === "granted") return "🔔 Alertes activées";
  if (Notification.permission === "denied") return "🔕 Refusées -- à réactiver dans les réglages du navigateur";
  return "🔔 Activer les alertes";
}

function rendreReglages(etat) {
  const favoris = listerFavoris();
  const voyages = listerVoyages();
  const theme = lireReglages().theme === "clair" ? "clair" : "sombre";
  return `<section class="ma-section">
    <div class="ma-section-titre">Apparence</div>
    <div class="ma-carte">
      <button type="button" class="ma-position-inline" id="ma-theme-btn" style="margin-top:0">${theme === "clair" ? "☀️ Mode clair actif — passer en sombre" : "🌙 Mode sombre actif — passer en clair"}</button>
    </div>

    <div class="ma-section-titre">🔔 Alertes</div>
    <div class="ma-carte">
      <div class="ma-hint" style="margin-top:0;padding-bottom:10px">Pluie imminente, gel, verglas, vent fort, orage… Fonctionne tant que l'appli reste ouverte ou récemment en arrière-plan -- pas de vraie notification appli complètement fermée (il faudrait un serveur).</div>
      <button type="button" class="ma-position-inline" id="ma-notif-btn" style="margin-top:0">${texteBoutonNotif()}</button>
      <div class="ma-hint" id="ma-notif-retour" style="display:none"></div>
    </div>

    <div class="ma-section-titre">Favoris</div>
    <div class="ma-carte">${
      favoris.length
        ? favoris.map((f, i) => `<div class="ma-favori" data-reg-fav="${i}"><div><div class="nom">${f.nom}</div><div class="admin">${f.admin || ""}</div></div><button type="button" class="ma-favori-etoile" data-reg-fav-retirer="${i}">★</button></div>`).join("")
        : `<div class="ma-hint" style="padding:16px 0">Aucune ville favorite pour l'instant. Touchez l'étoile en haut pour en ajouter.</div>`
    }</div>

    <div class="ma-section-titre">🧳 Mode voyage</div>
    <div class="ma-carte">
      ${voyages.length ? voyages.map((v) => `<div class="ma-favori" data-voyage-aller="${v.id}"><div><div class="nom">${v.nom} <span style="color:var(--accent);font-weight:800">${joursRestants(v.date)}</span></div><div class="admin">${new Date(v.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div></div><button type="button" class="ma-favori-etoile" data-voyage-retirer="${v.id}">✕</button></div>`).join("") : `<div class="ma-hint" style="padding:0 0 12px">Suis la météo d'une ville avant d'y partir.</div>`}
      <form id="ma-voyage-form" style="display:flex;flex-direction:column;gap:8px;margin-top:${voyages.length ? "14px" : "0"}">
        <input type="text" id="ma-voyage-ville" class="ma-recherche-barre-input" placeholder="Ville de destination…" required style="background:var(--fond-carte-forte);border:1px solid var(--bordure);border-radius:999px;padding:11px 16px;color:var(--texte);font-size:14px;font-family:inherit">
        <input type="date" id="ma-voyage-date" required style="background:var(--fond-carte-forte);border:1px solid var(--bordure);border-radius:999px;padding:11px 16px;color:var(--texte);font-size:14px;font-family:inherit">
        <button type="submit" class="ma-position-inline" style="margin-top:0;justify-content:center">Ajouter le voyage</button>
        <div class="ma-hint" id="ma-voyage-erreur" style="display:none;color:var(--rouge)"></div>
      </form>
    </div>

    <div class="ma-section-titre">💾 Sauvegarde</div>
    <div class="ma-carte">
      <div class="ma-hint" style="margin-top:0;padding-bottom:10px">Favoris, voyages et réglages, gardés uniquement sur cet appareil. Crée un lien de sauvegarde à conserver (ou à t'envoyer par mail) : ouvre-le sur un nouveau téléphone pour tout retrouver, sans compte.</div>
      <button type="button" class="ma-position-inline" id="ma-sauvegarde-btn" style="margin-top:0">💾 Créer un lien de sauvegarde</button>
      <div class="ma-hint" id="ma-sauvegarde-retour" style="display:none"></div>
    </div>

    <div class="ma-section-titre">À venir</div>
    <div class="ma-carte">
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
  $("ma-theme-btn")?.addEventListener("click", () => window.dispatchEvent(new CustomEvent("ma-basculer-theme")));

  $("ma-notif-btn")?.addEventListener("click", () => {
    if (typeof Notification === "undefined" || Notification.permission === "denied") return;
    window.dispatchEvent(new CustomEvent("ma-activer-notifications"));
  });

  $("ma-sauvegarde-btn")?.addEventListener("click", async () => {
    const retour = $("ma-sauvegarde-retour");
    retour.style.display = "block";
    retour.textContent = "Préparation…";
    try {
      const { lien } = await creerLienSauvegarde();
      if (navigator.share) {
        await navigator.share({ title: "Sauvegarde Météo AI", text: "Ouvre ce lien sur ton téléphone pour retrouver tes réglages Météo AI.", url: lien });
        retour.textContent = "✅ Lien partagé.";
      } else {
        await navigator.clipboard.writeText(lien);
        retour.textContent = "✅ Lien copié dans le presse-papiers — colle-le dans un mail ou une note pour le garder.";
      }
    } catch (e) {
      if (e.name !== "AbortError") retour.textContent = `⚠️ ${e.message || "Impossible de créer le lien."}`;
      else retour.style.display = "none";
    }
  });

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

  document.querySelectorAll("[data-voyage-aller]").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-voyage-retirer]")) return;
      const v = listerVoyages().find((x) => x.id === el.dataset.voyageAller);
      if (v) window.dispatchEvent(new CustomEvent("ma-aller-a", { detail: v }));
    }),
  );
  document.querySelectorAll("[data-voyage-retirer]").forEach((btn) =>
    btn.addEventListener("click", () => {
      retirerVoyage(btn.dataset.voyageRetirer);
      afficherOnglet("reglages");
    }),
  );

  $("ma-voyage-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ville = $("ma-voyage-ville").value.trim();
    const date = $("ma-voyage-date").value;
    const erreur = $("ma-voyage-erreur");
    erreur.style.display = "none";
    if (!ville || !date) return;
    try {
      const resultats = await rechercherVille(ville);
      if (!resultats.length) {
        erreur.textContent = "Ville introuvable.";
        erreur.style.display = "block";
        return;
      }
      const r = resultats[0];
      ajouterVoyage(r.nom, r.admin, r.lat, r.lon, date);
      afficherOnglet("reglages");
    } catch {
      erreur.textContent = "Recherche indisponible (réseau ?).";
      erreur.style.display = "block";
    }
  });
}

// Point d'entrée : charge la dernière ville connue (ou la position GPS),
// affiche la météo, et câble la recherche / les favoris.

import { positionGPS, nomDeLaVille, rechercherVille } from "./geo.js";
import { chargerActuel, chargerModeles } from "./meteo.js";
import { afficherChargement, afficherErreur, afficherMeteo } from "./ui.js";
import { derniereVille, retenirVille, listerFavoris, basculerFavori, estFavori, lireReglages, sauverReglages } from "./storage.js";
import { appliquerFondDynamique } from "./theme-meteo.js";
import { noterReleveJournalier } from "./historique.js";

const $ = (id) => document.getElementById(id);
let lieuCourant = null;

function cacherSplash() {
  const el = $("ma-splash");
  if (!el) return;
  el.classList.add("ma-splash-cachee");
  setTimeout(() => el.remove(), 600);
}

function appliquerTheme() {
  const clair = lireReglages().theme === "clair";
  document.body.classList.toggle("clair", clair);
  // La barre de statut du téléphone (couleur pilotée par cette balise) doit
  // suivre le thème -- sinon elle reste sombre au-dessus d'un fond clair (ou
  // l'inverse), ce qui donne une bande visiblement décalée en haut de
  // l'écran. Signalé par l'utilisateur le 2026-09-30.
  $("ma-meta-theme")?.setAttribute("content", clair ? "#dce8ff" : "#0b1224");
}

async function chargerEtAfficher(lieu) {
  lieuCourant = lieu;
  afficherChargement();
  try {
    const [actuel, modeles] = await Promise.all([chargerActuel(lieu.lat, lieu.lon), chargerModeles(lieu.lat, lieu.lon)]);
    appliquerFondDynamique(actuel.weathercode, actuel.is_day);
    afficherMeteo({ lieu, actuel, modeles });
    retenirVille(lieu);
    noterReleveJournalier(lieu, actuel);
  } catch (e) {
    afficherErreur(e.message || "Impossible de récupérer la météo pour le moment.", () => chargerEtAfficher(lieu));
  } finally {
    cacherSplash();
  }
}

async function utiliserPositionGPS() {
  fermerRecherche();
  afficherChargement();
  try {
    const p = await positionGPS();
    const v = await nomDeLaVille(p.lat, p.lon);
    chargerEtAfficher({ nom: v.nom, admin: v.admin, lat: p.lat, lon: p.lon, viaGPS: true });
  } catch (e) {
    afficherErreur(e.message, utiliserPositionGPS);
  }
}

function demarrer() {
  const derniere = derniereVille();
  if (derniere) chargerEtAfficher(derniere);
  else utiliserPositionGPS();
}

// ── Recherche ────────────────────────────────────────────────────────────

function rendreFavoris() {
  const favoris = listerFavoris();
  if (!favoris.length) {
    $("ma-recherche-favoris").innerHTML = "";
    return;
  }
  $("ma-recherche-favoris").innerHTML =
    `<div class="ma-recherche-titre">Favoris</div>` +
    favoris
      .map(
        (f, i) => `<div class="ma-favori" data-fav="${i}">
      <div><div class="nom">${f.nom}</div><div class="admin">${f.admin || ""}</div></div>
      <button type="button" class="ma-favori-etoile" data-fav-retirer="${i}">★</button>
    </div>`,
      )
      .join("");
  $("ma-recherche-favoris").querySelectorAll("[data-fav]").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-fav-retirer]")) return;
      const f = favoris[Number(el.dataset.fav)];
      fermerRecherche();
      chargerEtAfficher(f);
    }),
  );
  $("ma-recherche-favoris").querySelectorAll("[data-fav-retirer]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const f = favoris[Number(btn.dataset.favRetirer)];
      basculerFavori(f.nom, f.lat, f.lon, f.admin);
      rendreFavoris();
    }),
  );
}

let jetonRecherche = 0;
async function surSaisieRecherche(e) {
  const texte = e.target.value;
  const jeton = ++jetonRecherche;
  if (texte.trim().length < 2) {
    $("ma-recherche-resultats").innerHTML = "";
    return;
  }
  try {
    const resultats = await rechercherVille(texte);
    if (jeton !== jetonRecherche) return;
    $("ma-recherche-resultats").innerHTML =
      (resultats.length ? `<div class="ma-recherche-titre">Résultats</div>` : `<div class="ma-recherche-titre">Aucun résultat</div>`) +
      resultats
        .map(
          (r, i) => `<div class="ma-resultat" data-res="${i}">
        <div><div class="nom">${r.nom}</div><div class="admin">${r.admin}</div></div>
      </div>`,
        )
        .join("");
    $("ma-recherche-resultats").querySelectorAll("[data-res]").forEach((el) =>
      el.addEventListener("click", () => {
        const r = resultats[Number(el.dataset.res)];
        fermerRecherche();
        chargerEtAfficher({ nom: r.nom, admin: r.admin, lat: r.lat, lon: r.lon });
      }),
    );
  } catch {
    if (jeton === jetonRecherche) $("ma-recherche-resultats").innerHTML = `<div class="ma-recherche-titre">Recherche indisponible (réseau ?)</div>`;
  }
}

function ouvrirRecherche() {
  $("ma-recherche-couche").classList.remove("hidden");
  $("ma-recherche-input").value = "";
  $("ma-recherche-resultats").innerHTML = "";
  rendreFavoris();
  setTimeout(() => $("ma-recherche-input").focus(), 50);
}
function fermerRecherche() {
  $("ma-recherche-couche").classList.add("hidden");
}

function cablerUI() {
  $("ma-recherche-btn").addEventListener("click", ouvrirRecherche);
  $("ma-lieu-btn").addEventListener("click", ouvrirRecherche);
  $("ma-recherche-fermer").addEventListener("click", fermerRecherche);
  $("ma-recherche-input").addEventListener("input", surSaisieRecherche);
  $("ma-recherche-couche").addEventListener("click", (e) => {
    if (e.target === $("ma-recherche-couche")) fermerRecherche();
  });
  $("ma-position-btn").addEventListener("click", utiliserPositionGPS);
  $("ma-favori-btn").addEventListener("click", () => {
    if (!lieuCourant) return;
    basculerFavori(lieuCourant.nom, lieuCourant.lat, lieuCourant.lon, lieuCourant.admin);
    const actif = estFavori(lieuCourant.nom, lieuCourant.lat, lieuCourant.lon);
    $("ma-favori-btn").textContent = actif ? "★" : "☆";
    $("ma-favori-btn").classList.toggle("actif", actif);
  });
  $("ma-reglages-btn").addEventListener("click", () => document.querySelector('[data-tab="reglages"]')?.click());
  window.addEventListener("ma-aller-a", (e) => chargerEtAfficher(e.detail));
  window.addEventListener("ma-basculer-theme", () => {
    const nouveau = lireReglages().theme === "clair" ? "sombre" : "clair";
    sauverReglages({ theme: nouveau });
    appliquerTheme();
  });
}

appliquerTheme();
cablerUI();
demarrer();

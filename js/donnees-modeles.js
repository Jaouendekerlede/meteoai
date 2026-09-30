// Lecture des séries "champ_modele" renvoyées par Open-Meteo (voir
// meteo.js) -- utilitaires partagés entre l'affichage (ui.js) et le calcul
// des alertes (alertes-meteo.js).

import { MODELES } from "./config.js";

// Index de l'heure la plus proche de maintenant dans une série temps (ISO).
export function indexMaintenant(temps) {
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

// Une valeur par modèle, dans l'ordre de MODELES (null si ce modèle n'a pas
// de valeur à cet indice) -- l'ordre doit rester aligné avec MODELES pour
// que la pondération (confiance.js : poidsModeles) reste correcte.
export function valeursModeles(parChamp, champ, i) {
  return MODELES.map((m) => parChamp[champ]?.[m]?.[i]);
}

// Valeur "affichage" pour un champ : le modèle français (le plus précis sur
// la France) en priorité, mais celui-ci ne couvre que ~4 jours -- au-delà,
// on prend le premier autre modèle qui a une valeur à cet indice, plutôt que
// d'afficher un blanc. Utilisé partout où une seule valeur (pas la
// comparaison) doit être montrée.
export function valeurAffichage(parChamp, champ, i) {
  for (const m of MODELES) {
    const v = parChamp[champ]?.[m]?.[i];
    if (Number.isFinite(v)) return v;
  }
  return null;
}

// Comme valeurAffichage, mais interpolé linéairement entre les deux heures
// qui encadrent l'instant donné (par défaut maintenant) -- plus précis
// qu'un simple arrondi à l'heure la plus proche pour les champs qui n'ont
// pas d'équivalent dans les "conditions actuelles" d'Open-Meteo (pluie en
// %, UV : seulement horaires, pas d'observation "actuelle" dédiée).
export function valeurInterpolee(horaire, champ, maintenant = Date.now()) {
  const temps = horaire.temps.map((t) => new Date(t).getTime());
  let i = 0;
  while (i < temps.length - 2 && temps[i + 1] < maintenant) i++;
  const v0 = valeurAffichage(horaire.parChamp, champ, i);
  const v1 = valeurAffichage(horaire.parChamp, champ, i + 1);
  if (!Number.isFinite(v0)) return v1 ?? null;
  if (!Number.isFinite(v1) || temps[i + 1] <= temps[i]) return v0;
  const fraction = Math.max(0, Math.min(1, (maintenant - temps[i]) / (temps[i + 1] - temps[i])));
  return v0 + (v1 - v0) * fraction;
}

// Même repli, pour les champs texte (sunrise/sunset : horodatage ISO, pas un nombre).
export function valeurAffichageTexte(parChamp, champ, i) {
  for (const m of MODELES) {
    const v = parChamp[champ]?.[m]?.[i];
    if (v) return v;
  }
  return null;
}

// Historique personnel : un relevé par jour et par lieu (température,
// condition), pour pouvoir dire "il faisait X° hier à cette heure ici".
// Aucune donnée rétroactive n'est possible (on ne connaît pas le passé) --
// la collecte démarre à partir du premier lancement de l'appli.

import { STORAGE_KEYS } from "./config.js";

const MAX_RELEVES = 500;

function lire() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.historique)) || [];
  } catch {
    return [];
  }
}

function ecrire(releves) {
  try {
    localStorage.setItem(STORAGE_KEYS.historique, JSON.stringify(releves.slice(-MAX_RELEVES)));
  } catch {
    // Stockage plein ou bloqué : tant pis, pas bloquant.
  }
}

function cleLieu(lieu) {
  return `${lieu.nom}|${lieu.lat.toFixed(2)}|${lieu.lon.toFixed(2)}`;
}

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

// Un seul relevé conservé par (lieu, jour) -- écrase celui du jour si on
// revient plusieurs fois sur l'appli le même jour, pour rester à jour.
export function noterReleveJournalier(lieu, actuel) {
  if (!Number.isFinite(actuel?.temperature_2m)) return;
  const cle = cleLieu(lieu);
  const jour = aujourdhui();
  const releves = lire().filter((r) => !(r.cle === cle && r.jour === jour));
  releves.push({ cle, jour, heure: new Date().getHours(), temp: Math.round(actuel.temperature_2m), code: actuel.weathercode });
  ecrire(releves);
}

// Le relevé de la veille pour ce lieu, s'il existe (comparaison "hier à
// cette heure-ci"). null si l'appli n'a jamais enregistré ce lieu hier.
export function releveVeille(lieu) {
  const cle = cleLieu(lieu);
  const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  return lire().find((r) => r.cle === cle && r.jour === hier) || null;
}

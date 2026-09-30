// Stockage local : villes favorites, dernière position, réglages.

import { STORAGE_KEYS } from "./config.js";

function lireJson(cle, defaut) {
  try {
    const v = JSON.parse(localStorage.getItem(cle));
    return v ?? defaut;
  } catch {
    return defaut;
  }
}

function ecrireJson(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage plein ou bloqué (navigation privée) : tant pis, pas bloquant.
  }
}

export function listerFavoris() {
  return lireJson(STORAGE_KEYS.favoris, []);
}

export function estFavori(nom, lat, lon) {
  return listerFavoris().some((f) => f.nom === nom && Math.abs(f.lat - lat) < 0.01 && Math.abs(f.lon - lon) < 0.01);
}

export function basculerFavori(nom, lat, lon, admin = "") {
  const favoris = listerFavoris();
  const i = favoris.findIndex((f) => f.nom === nom && Math.abs(f.lat - lat) < 0.01 && Math.abs(f.lon - lon) < 0.01);
  if (i >= 0) favoris.splice(i, 1);
  else favoris.push({ nom, lat, lon, admin });
  ecrireJson(STORAGE_KEYS.favoris, favoris);
  return i < 0;
}

export function derniereVille() {
  return lireJson(STORAGE_KEYS.derniereVille, null);
}

export function retenirVille(ville) {
  ecrireJson(STORAGE_KEYS.derniereVille, ville);
}

export function lireReglages() {
  return lireJson(STORAGE_KEYS.reglages, {});
}

export function sauverReglages(partiel) {
  ecrireJson(STORAGE_KEYS.reglages, { ...lireReglages(), ...partiel });
}

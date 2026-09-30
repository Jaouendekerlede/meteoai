// Lien de sauvegarde : toutes les données de l'appli (favoris, voyages,
// historique, réglages) compressées dans l'adresse de l'appli, après le
// « # ». Gardé (envoyé à soi-même, noté quelque part…), il suffit de
// l'ouvrir sur un nouveau téléphone pour tout retrouver -- sans compte, sans
// serveur : la partie après « # » n'est jamais envoyée à GitHub Pages.
// Volontairement sans rappel automatique (juste un bouton dans Réglages) :
// les données ici (favoris, réglages météo) sont moins critiques que des
// clés d'API, pas besoin d'insister.

import { exporterDonnees, importerDonnees } from "./storage.js";

const MARQUE = "#restaurer=";

async function transformer(octets, flux) {
  const sortie = new Blob([octets]).stream().pipeThrough(flux);
  return new Uint8Array(await new Response(sortie).arrayBuffer());
}

function versBase64Url(octets) {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function depuisBase64Url(texte) {
  const binaire = atob(texte.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

// Adresse de l'appli (sans « # » ni paramètres) + données compressées.
export async function creerLienSauvegarde(adresse = location.href) {
  const sauvegarde = exporterDonnees();
  const octets = await transformer(new TextEncoder().encode(JSON.stringify(sauvegarde)), new CompressionStream("deflate"));
  const base = adresse.split("#")[0].split("?")[0];
  return { lien: `${base}${MARQUE}${versBase64Url(octets)}`, date: sauvegarde.date };
}

export function estLienSauvegarde(hash) {
  return typeof hash === "string" && hash.startsWith(MARQUE);
}

// Sauvegarde contenue dans le « # » de l'adresse. Lève une erreur si le lien
// est abîmé (par exemple coupé par une messagerie).
async function lireLienSauvegarde(hash) {
  const octets = await transformer(depuisBase64Url(hash.slice(MARQUE.length)), new DecompressionStream("deflate"));
  return JSON.parse(new TextDecoder().decode(octets));
}

// À appeler une fois au démarrage. Si l'adresse contient un lien de
// sauvegarde, restaure les données et nettoie l'adresse. Renvoie le nombre
// d'éléments restaurés, ou null si l'adresse n'en contenait pas.
export async function restaurerDepuisAdresse() {
  const hash = location.hash;
  if (!estLienSauvegarde(hash)) return null;
  history.replaceState(null, "", location.pathname);
  const sauvegarde = await lireLienSauvegarde(hash);
  return importerDonnees(sauvegarde);
}

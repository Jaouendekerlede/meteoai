// Radar de précipitations en direct (RainViewer, gratuit, sans clé) sur une
// carte Leaflet chargée à la demande seulement (pas au premier chargement de
// l'appli, pour rester léger tant qu'on ne regarde pas la carte).

import { API_RAINVIEWER } from "./config.js";

let promesseLeaflet = null;
function chargerLeaflet() {
  if (promesseLeaflet) return promesseLeaflet;
  promesseLeaflet = new Promise((resoudre, echec) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resoudre();
    script.onerror = () => echec(new Error("Carte indisponible (réseau ?)."));
    document.head.appendChild(script);
  });
  return promesseLeaflet;
}

let carte = null;
let coucheRadar = null;
let frames = [];
let nbPast = 0;
let indexFrame = 0;
let enLecture = false;
let minuteurLecture = null;
let surChangement = () => {};

function urlFrame(f) {
  return `https://tilecache.rainviewer.com${f.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

async function chargerFrames() {
  const r = await fetch(API_RAINVIEWER);
  if (!r.ok) throw new Error(`Radar indisponible (HTTP ${r.status}).`);
  const d = await r.json();
  frames = [...d.radar.past, ...(d.radar.nowcast || [])];
  nbPast = d.radar.past.length;
  indexFrame = nbPast - 1; // dernière observation réelle (pas encore une prévision)
}

function afficherFrameActuelle() {
  if (!frames.length || !carte) return;
  const f = frames[indexFrame];
  const nouvelle = L.tileLayer(urlFrame(f), { pane: "radar", opacity: 0.65 });
  nouvelle.addTo(carte);
  const ancienne = coucheRadar;
  coucheRadar = nouvelle;
  // Retirer l'ancienne une fois la nouvelle chargée (transition sans clignotement).
  nouvelle.once("load", () => ancienne?.remove());
  setTimeout(() => ancienne?.remove(), 1200); // filet de sécurité si "load" ne se déclenche pas
  surChangement(infosFrame());
}

export function infosFrame() {
  if (!frames.length) return { texte: "", index: 0, total: 0, prevision: false };
  const f = frames[indexFrame];
  const prevision = indexFrame >= nbPast;
  const texte = new Date(f.time * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return { texte, index: indexFrame, total: frames.length, prevision };
}

// conteneurId : id d'un <div> déjà dans le DOM. onChange(infosFrame) est
// rappelé à chaque frame affichée (pour mettre à jour le curseur/l'heure).
export async function initRadar(conteneurId, lat, lon, onChange) {
  surChangement = onChange || (() => {});
  await chargerLeaflet();
  if (!carte) {
    carte = L.map(conteneurId, { zoomControl: false, attributionControl: false }).setView([lat, lon], 7);
    // OpenStreetMap (gratuit, sans clé) -- inversé en CSS (voir style.css,
    // pane "fond" seulement) pour rester sombre comme le reste de l'appli ;
    // le radar, dans son propre pane, n'est pas affecté par ce filtre.
    carte.createPane("fond");
    carte.getPane("fond").style.zIndex = 200;
    carte.createPane("radar");
    carte.getPane("radar").style.zIndex = 400;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { pane: "fond", maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(carte);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(carte);
    L.control.zoom({ position: "bottomright" }).addTo(carte);
    L.marker([lat, lon]).addTo(carte);
  } else {
    carte.setView([lat, lon], carte.getZoom());
  }
  await chargerFrames();
  afficherFrameActuelle();
  setTimeout(() => carte.invalidateSize(), 60);
}

export function redimensionner() {
  carte?.invalidateSize();
}

export function allerFrame(i) {
  if (!frames.length) return;
  indexFrame = Math.max(0, Math.min(frames.length - 1, i));
  afficherFrameActuelle();
}

export function jouerPause() {
  if (enLecture) {
    clearInterval(minuteurLecture);
    enLecture = false;
    return false;
  }
  enLecture = true;
  minuteurLecture = setInterval(() => {
    indexFrame = (indexFrame + 1) % frames.length;
    afficherFrameActuelle();
  }, 700);
  return true;
}

export function arreterLecture() {
  clearInterval(minuteurLecture);
  enLecture = false;
}

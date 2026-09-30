// Palette de couleurs selon la condition météo + jour/nuit -- un seul
// "design system" réutilisé pour le fond dynamique, le halo de l'icône,
// et le dégradé du graphique (cohérence visuelle partout).

const PALETTES = {
  clair_jour: { haut: "#2f6fd6", bas: "#0b1224", accent: "#ffc857" },
  clair_nuit: { haut: "#131b3d", bas: "#080c1a", accent: "#a7b8ff" },
  nuageux_jour: { haut: "#3f4c6b", bas: "#11162a", accent: "#cfd6e6" },
  nuageux_nuit: { haut: "#161d33", bas: "#0a0e1c", accent: "#8a97b8" },
  pluie_jour: { haut: "#243657", bas: "#0c1220", accent: "#4fe0ff" },
  pluie_nuit: { haut: "#0e1627", bas: "#070a14", accent: "#4fe0ff" },
  orage: { haut: "#2a1c3f", bas: "#0d0916", accent: "#c792ff" },
  neige_jour: { haut: "#48597a", bas: "#141b2e", accent: "#eaf6ff" },
  neige_nuit: { haut: "#182238", bas: "#0a0e1a", accent: "#cfe0ff" },
  brouillard: { haut: "#3a4356", bas: "#12151f", accent: "#c7ced9" },
};

const ORAGE = [95, 96, 99];
const NEIGE = [71, 73, 75, 77, 85, 86];
const BROUILLARD = [45, 48];
const PLUIE = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
const NUAGEUX = [2, 3];

export function paletteMeteo(code, estJour) {
  const jour = estJour !== 0;
  if (ORAGE.includes(code)) return PALETTES.orage;
  if (NEIGE.includes(code)) return jour ? PALETTES.neige_jour : PALETTES.neige_nuit;
  if (BROUILLARD.includes(code)) return PALETTES.brouillard;
  if (PLUIE.includes(code)) return jour ? PALETTES.pluie_jour : PALETTES.pluie_nuit;
  if (NUAGEUX.includes(code)) return jour ? PALETTES.nuageux_jour : PALETTES.nuageux_nuit;
  return jour ? PALETTES.clair_jour : PALETTES.clair_nuit;
}

// Applique la palette au fond de l'appli (variables CSS lues par style.css).
export function appliquerFondDynamique(code, estJour) {
  const p = paletteMeteo(code, estJour);
  const racine = document.documentElement.style;
  racine.setProperty("--fond-haut-dyn", p.haut);
  racine.setProperty("--fond-bas-dyn", p.bas);
  racine.setProperty("--accent-meteo", p.accent);
}

// Catégorie de précipitation actuelle (pour l'overlay de pluie/neige animée).
export function categoriePrecip(code) {
  if (NEIGE.includes(code)) return "neige";
  if (ORAGE.includes(code) || PLUIE.includes(code)) return "pluie";
  return null;
}

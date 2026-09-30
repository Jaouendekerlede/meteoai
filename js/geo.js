// Position (GPS du téléphone), recherche de ville et « nom de la ville la
// plus proche » (API gratuites, sans clé -- voir config.js).

import { API_GEOCODAGE, API_GEOCODAGE_INVERSE } from "./config.js";

export function positionGPS({ delaiMs = 8000 } = {}) {
  return new Promise((resoudre, echec) => {
    if (!navigator.geolocation) return echec(new Error("Géolocalisation non disponible sur cet appareil."));
    navigator.geolocation.getCurrentPosition(
      (p) => resoudre({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => echec(new Error(e.code === 1 ? "Position refusée : autorisez la géolocalisation pour ce site." : "Position indisponible pour l'instant.")),
      { enableHighAccuracy: false, timeout: delaiMs, maximumAge: 5 * 60 * 1000 },
    );
  });
}

// Ville la plus proche d'un point (pour l'affichage seulement -- le calcul
// météo utilise toujours les coordonnées exactes du GPS, pas cette ville).
export async function nomDeLaVille(lat, lon) {
  try {
    const r = await fetch(`${API_GEOCODAGE_INVERSE}?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return { nom: d.city || d.locality || d.principalSubdivision || "Ma position", admin: [d.principalSubdivision, d.countryName].filter(Boolean).join(", ") };
  } catch {
    return { nom: "Ma position", admin: "" };
  }
}

// Recherche de ville par nom (barre de recherche) : jusqu'à 6 résultats,
// avec la région pour distinguer les homonymes (ex. plusieurs « Saint-Denis »).
export async function rechercherVille(texte) {
  const q = texte.trim();
  if (q.length < 2) return [];
  const r = await fetch(`${API_GEOCODAGE}?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return (d.results || []).map((v) => ({
    nom: v.name,
    admin: [v.admin2, v.admin1, v.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", "),
    lat: v.latitude,
    lon: v.longitude,
    pays: v.country,
  }));
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

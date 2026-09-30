// Appels à Open-Meteo (gratuit, sans clé) : conditions actuelles (meilleur
// modèle du moment, choisi par Open-Meteo lui-même) + prévisions de
// plusieurs modèles séparés, pour pouvoir les comparer (voir confiance.js).

import { API_METEO, MODELES, CHAMPS_HORAIRES, CHAMPS_JOURNALIERS, JOURS_PREVISION } from "./config.js";

async function appelJson(params) {
  const r = await fetch(`${API_METEO}?${params}`);
  if (!r.ok) throw new Error(`Service météo indisponible (HTTP ${r.status}).`);
  return r.json();
}

export async function chargerActuel(lat, lon) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weathercode,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,cloud_cover,is_day",
    timezone: "auto",
  });
  const d = await appelJson(p);
  return { ...d.current, timezone: d.timezone, utc_offset_seconds: d.utc_offset_seconds };
}

// Regroupe les séries "champ_modele" -> { temps, parChamp: { champ: { modele: valeur[] } } }.
function regrouperParModele(bloc, champs) {
  const temps = bloc.time || [];
  const parChamp = {};
  for (const champ of champs) {
    parChamp[champ] = {};
    for (const m of MODELES) parChamp[champ][m] = bloc[`${champ}_${m}`] || [];
  }
  return { temps, parChamp };
}

export async function chargerModeles(lat, lon, { jours = JOURS_PREVISION } = {}) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: CHAMPS_HORAIRES.join(","),
    daily: CHAMPS_JOURNALIERS.join(","),
    models: MODELES.join(","),
    forecast_days: String(jours),
    timezone: "auto",
  });
  const d = await appelJson(p);
  return {
    timezone: d.timezone,
    horaire: regrouperParModele(d.hourly, CHAMPS_HORAIRES),
    journalier: regrouperParModele(d.daily, CHAMPS_JOURNALIERS),
  };
}

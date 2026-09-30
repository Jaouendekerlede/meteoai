// Configuration -- adresses des API (toutes gratuites, sans clé) et clés de
// stockage local.

export const API_METEO = "https://api.open-meteo.com/v1/forecast";
export const API_GEOCODAGE = "https://geocoding-api.open-meteo.com/v1/search";
export const API_GEOCODAGE_INVERSE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

// Modèles comparés pour le score de confiance : un modèle français à haute
// résolution (AROME + ARPEGE réunis par Open-Meteo sous "seamless"), le
// modèle européen, l'américain et l'allemand -- quatre sources
// indépendantes, un bon compromis précision/diversité.
export const MODELES = ["meteofrance_seamless", "ecmwf_ifs025", "gfs_seamless", "icon_seamless"];
export const LABELS_MODELES = {
  meteofrance_seamless: "Météo-France (AROME/ARPEGE)",
  ecmwf_ifs025: "ECMWF (Europe)",
  gfs_seamless: "GFS (États-Unis)",
  icon_seamless: "ICON (Allemagne)",
};

export const CHAMPS_HORAIRES = ["temperature_2m", "precipitation_probability", "precipitation", "wind_speed_10m", "wind_gusts_10m", "cloud_cover", "relative_humidity_2m", "weathercode", "is_day"];
export const CHAMPS_JOURNALIERS = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "precipitation_probability_max", "weathercode", "wind_speed_10m_max", "wind_gusts_10m_max", "uv_index_max", "sunrise", "sunset"];

export const STORAGE_KEYS = {
  favoris: "meteoai_favoris",
  derniereVille: "meteoai_derniere_ville",
  reglages: "meteoai_reglages",
};

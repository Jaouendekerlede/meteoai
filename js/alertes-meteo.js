// Alertes météo calculées localement (pluie/neige imminente, gel, gel au
// sol, verglas, vent fort, orage, chute de température, incertitude) à
// partir des données déjà chargées -- pas d'appel réseau supplémentaire.
// Utilisées à la fois pour l'affichage (bandeau sur l'accueil) et pour les
// notifications (voir main.js).

import { valeurAffichage, valeursModeles } from "./donnees-modeles.js";
import { calculerConfiance, poidsModeles } from "./confiance.js";
import { MODELES, LABELS_MODELES } from "./config.js";

const NOMS_MODELES = Object.values(LABELS_MODELES);

const CODES_NEIGE = [71, 73, 75, 77, 85, 86];
const CODES_ORAGE = [95, 96, 99];
const HORIZON_H = 6; // heures scrutées pour "imminent"

function serie(h, champ, iM, n = HORIZON_H + 1) {
  return Array.from({ length: n }, (_, k) => valeurAffichage(h.parChamp, champ, iM + k));
}

function heureTexte(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// actuel : conditions "maintenant" (meilleur modèle, voir meteo.js).
// modeles.horaire : séries multi-modèles. iM : index de l'heure la plus
// proche de maintenant. conf : score de confiance déjà calculé pour
// "maintenant" (évite un recalcul si l'appelant l'a déjà -- voir ui.js) ;
// recalculé ici si absent (usage autonome, ex. main.js pour les notifications).
export function calculerAlertes({ actuel, modeles, iM, conf }) {
  const alertes = [];
  const h = modeles.horaire;
  const tempActuelle = actuel?.temperature_2m;
  conf ??= calculerConfiance({
    tempsC: valeursModeles(h.parChamp, "temperature_2m", iM),
    precipPct: valeursModeles(h.parChamp, "precipitation_probability", iM),
    ventKmh: valeursModeles(h.parChamp, "wind_speed_10m", iM),
    labelsModeles: NOMS_MODELES,
    poids: poidsModeles(MODELES.length, 0),
  });

  // Pluie ou neige imminente -- distingue un vrai risque (probabilité ET
  // quantité) d'une simple probabilité résiduelle sans conséquence.
  for (let k = 0; k <= HORIZON_H; k++) {
    const i = iM + k;
    const proba = valeurAffichage(h.parChamp, "precipitation_probability", i);
    const mm = valeurAffichage(h.parChamp, "precipitation", i);
    if (Number.isFinite(proba) && proba >= 60 && Number.isFinite(mm) && mm >= 0.2) {
      const neige = CODES_NEIGE.includes(valeurAffichage(h.parChamp, "weathercode", i));
      alertes.push({
        id: neige ? "neige" : "pluie",
        niveau: "info",
        icone: neige ? "❄️" : "🌧️",
        texte: k === 0 ? `${neige ? "Neige" : "Pluie"} en cours.` : `${neige ? "Neige" : "Pluie"} prévue vers ${heureTexte(h.temps[i])} (dans ${k === 1 ? "environ 1 h" : `environ ${k} h`}).`,
      });
      break;
    }
  }

  // Orage : instabilité atmosphérique (CAPE) ou code météo orageux.
  for (let k = 0; k <= HORIZON_H; k++) {
    const i = iM + k;
    const cape = valeurAffichage(h.parChamp, "cape", i);
    const orageCode = CODES_ORAGE.includes(valeurAffichage(h.parChamp, "weathercode", i));
    if ((Number.isFinite(cape) && cape >= 1000) || orageCode) {
      alertes.push({ id: "orage", niveau: "danger", icone: "⛈️", texte: k === 0 ? "Risque d'orage actuellement." : `Risque d'orage possible d'ici ${k} h.` });
      break;
    }
  }

  // Gel de l'air.
  const tempsProches = serie(h, "temperature_2m", iM);
  const tempMinProche = Math.min(...tempsProches.filter(Number.isFinite));
  if (Number.isFinite(tempActuelle) && tempActuelle <= 0) {
    alertes.push({ id: "gel", niveau: "attention", icone: "🥶", texte: `Gel actuellement (${Math.round(tempActuelle)} °C).` });
  } else if (Number.isFinite(tempMinProche) && tempMinProche <= 0) {
    alertes.push({ id: "gel", niveau: "attention", icone: "🥶", texte: "Risque de gel dans les prochaines heures." });
  }

  // Gel au sol : peut geler au sol même quand l'air reste positif (routes,
  // pare-brise) -- information distincte, pas redondante avec le gel de l'air.
  const solActuel = valeurAffichage(h.parChamp, "soil_temperature_0cm", iM);
  if (Number.isFinite(solActuel) && solActuel <= 0 && Number.isFinite(tempActuelle) && tempActuelle > 0) {
    alertes.push({ id: "gel-sol", niveau: "info", icone: "🧊", texte: "Gel au sol possible malgré une température de l'air positive (routes, pare-brise)." });
  }

  // Verglas : autour de 0 °C, humide, avec de la précipitation toute proche.
  const humidite = actuel?.relative_humidity_2m;
  const precipProche = valeurAffichage(h.parChamp, "precipitation", iM) || valeurAffichage(h.parChamp, "precipitation", iM + 1);
  if (Number.isFinite(tempActuelle) && tempActuelle <= 2 && tempActuelle >= -3 && Number.isFinite(humidite) && humidite >= 75 && Number.isFinite(precipProche) && precipProche > 0) {
    alertes.push({ id: "verglas", niveau: "danger", icone: "⚠️", texte: "Risque de verglas (température proche de 0 °C, humidité et précipitation)." });
  }

  // Vent fort (rafales).
  const rafaleActuelle = actuel?.wind_gusts_10m;
  const rafalesProches = serie(h, "wind_gusts_10m", iM).filter(Number.isFinite);
  const rafaleMaxProche = rafalesProches.length ? Math.max(...rafalesProches) : null;
  if (Number.isFinite(rafaleActuelle) && rafaleActuelle >= 70) {
    alertes.push({ id: "vent", niveau: "danger", icone: "💨", texte: `Vent fort : rafales à ${Math.round(rafaleActuelle)} km/h actuellement.` });
  } else if (Number.isFinite(rafaleMaxProche) && rafaleMaxProche >= 70) {
    alertes.push({ id: "vent", niveau: "attention", icone: "💨", texte: `Rafales jusqu'à ${Math.round(rafaleMaxProche)} km/h prévues dans les prochaines heures.` });
  }

  // Tendance : chute rapide de température (3 h).
  const tempDans3h = valeurAffichage(h.parChamp, "temperature_2m", iM + 3);
  if (Number.isFinite(tempActuelle) && Number.isFinite(tempDans3h) && tempActuelle - tempDans3h >= 4) {
    alertes.push({ id: "tendance-froid", niveau: "info", icone: "📉", texte: `Rafraîchissement rapide : ${Math.round(tempActuelle - tempDans3h)} °C de moins prévus d'ici 3 h.` });
  }

  // Désaccord fort entre modèles : à prendre avec prudence.
  if (conf && conf.score < 40) {
    alertes.push({ id: "incertitude", niveau: "attention", icone: "❓", texte: "Prévisions incertaines : les modèles divergent nettement sur les prochaines heures." });
  }

  return alertes;
}

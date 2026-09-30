// Score de confiance : mesure la CONCORDANCE entre les modèles météo, pas
// une probabilité de réussite de la prévision. Des modèles proches ->
// confiance haute ; des modèles qui divergent -> confiance basse, avec le
// détail de pourquoi (température, pluie, vent), pour rester transparent
// sur l'incertitude plutôt que de la cacher derrière un chiffre unique.

function ecartType(valeurs) {
  const v = valeurs.filter((x) => Number.isFinite(x));
  if (v.length < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}

function moyenne(valeurs) {
  const v = valeurs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function ecartMax(valeurs) {
  const v = valeurs.filter((x) => Number.isFinite(x));
  return v.length < 2 ? 0 : Math.max(...v) - Math.min(...v);
}

function score(x, zero, cent) {
  // 100 à "cent", 0 à "zero" (zero > cent), linéaire entre les deux.
  return Math.round(Math.max(0, Math.min(100, ((zero - x) / (zero - cent)) * 100)));
}

// tempsC, precipPct, ventKmh : valeur par modèle (array, un par modèle, au
// même instant). Renvoie { score, niveau, texte, details: [{ label, ok }] }.
export function calculerConfiance({ tempsC = [], precipPct = [], ventKmh = [] }) {
  const details = [];

  const ecartTemp = ecartMax(tempsC);
  const sTemp = score(ecartTemp, 5, 0.3);
  details.push({
    label: ecartTemp < 1 ? `Températures très proches (±${ecartTemp.toFixed(1)} °C)` : ecartTemp < 3 ? `Petit écart de température entre modèles (${ecartTemp.toFixed(1)} °C)` : `Températures qui divergent nettement (jusqu'à ${ecartTemp.toFixed(1)} °C d'écart)`,
    points: sTemp >= 70 ? 1 : sTemp >= 40 ? 0 : -1,
  });

  const ecartPrecip = ecartMax(precipPct);
  const sPrecip = score(ecartPrecip, 70, 5);
  const desaccordPluie = precipPct.some((p) => p >= 50) && precipPct.some((p) => p < 50);
  details.push({
    label: desaccordPluie
      ? `Modèles en désaccord sur la pluie (de ${Math.round(Math.min(...precipPct))} % à ${Math.round(Math.max(...precipPct))} %)`
      : ecartPrecip < 15
        ? "Modèles d'accord sur le risque de pluie"
        : `Risque de pluie estimé différemment selon les modèles (${Math.round(ecartPrecip)} points d'écart)`,
    points: desaccordPluie ? -2 : sPrecip >= 70 ? 1 : sPrecip >= 40 ? 0 : -1,
  });

  const ecartVent = ecartMax(ventKmh);
  const sVent = ventKmh.length ? score(ecartVent, 30, 3) : 100;
  if (ventKmh.length) {
    details.push({
      label: ecartVent < 8 ? "Vent estimé de façon cohérente" : `Vent estimé différemment selon les modèles (±${Math.round(ecartVent)} km/h)`,
      points: sVent >= 70 ? 1 : sVent >= 40 ? 0 : -1,
    });
  }

  let total = Math.round(sTemp * 0.4 + sPrecip * 0.45 + sVent * 0.15);
  if (desaccordPluie) total = Math.min(total, 60); // un vrai désaccord pluie/pas pluie plafonne la confiance

  const niveau = total >= 75 ? "haute" : total >= 50 ? "moyenne" : "basse";
  const texte = total >= 75 ? "Modèles fortement concordants." : total >= 50 ? "Modèles globalement d'accord, quelques nuances." : "Modèles divergents : à prendre avec prudence.";

  return { score: total, niveau, texte, details, moyenneTemp: moyenne(tempsC), moyennePrecip: moyenne(precipPct), moyenneVent: moyenne(ventKmh) };
}

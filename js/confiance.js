// Score de confiance : mesure la CONCORDANCE entre les modèles météo, pas
// une probabilité de réussite de la prévision. Des modèles proches ->
// confiance haute ; des modèles qui divergent -> confiance basse, avec le
// détail de pourquoi (température, pluie, vent), pour rester transparent
// sur l'incertitude plutôt que de la cacher derrière un chiffre unique.
//
// Pondération : dans les 48 premières heures, Météo-France (AROME, haute
// résolution locale) compte double dans le calcul de l'écart -- au-delà,
// tous les modèles pèsent pareil (AROME n'est alors qu'une extrapolation
// ARPEGE, pas plus fiable que les autres). Voir poidsModeles().

function moyenne(valeurs) {
  const v = valeurs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function moyennePonderee(valeurs, poids) {
  let sommePoids = 0;
  let somme = 0;
  valeurs.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const p = poids?.[i] ?? 1;
    somme += v * p;
    sommePoids += p;
  });
  return sommePoids ? somme / sommePoids : null;
}

// Écart pondéré max autour de la moyenne pondérée -- plus représentatif
// qu'un simple max-min quand un modèle compte double.
function ecartPondere(valeurs, poids) {
  const finies = valeurs.map((v, i) => [v, poids?.[i] ?? 1]).filter(([v]) => Number.isFinite(v));
  if (finies.length < 2) return 0;
  const m = moyennePonderee(valeurs, poids);
  return Math.max(...finies.map(([v]) => Math.abs(v - m))) * 2;
}

function ecartMax(valeurs) {
  const v = valeurs.filter((x) => Number.isFinite(x));
  return v.length < 2 ? 0 : Math.max(...v) - Math.min(...v);
}

function score(x, zero, cent) {
  // 100 à "cent", 0 à "zero" (zero > cent), linéaire entre les deux.
  return Math.round(Math.max(0, Math.min(100, ((zero - x) / (zero - cent)) * 100)));
}

// Un modèle isolé très éloigné des autres (qui, eux, se serrent) : signalé
// à part plutôt que noyé dans une moyenne -- ex. un seul modèle annonce de
// la neige quand les trois autres n'en voient pas.
function detecterModeleIsole(valeurs, noms, seuilEcart) {
  const paires = valeurs.map((v, i) => [v, noms[i]]).filter(([v]) => Number.isFinite(v));
  if (paires.length < 3) return null;
  for (let i = 0; i < paires.length; i++) {
    const [vi, nomi] = paires[i];
    const autres = paires.filter((_, j) => j !== i).map(([v]) => v);
    const ecartAutres = Math.max(...autres) - Math.min(...autres);
    const ecartAvecMoi = Math.min(...autres.map((v) => Math.abs(v - vi)));
    if (ecartAutres < seuilEcart * 0.4 && ecartAvecMoi > seuilEcart) return nomi;
  }
  return null;
}

// tempsC, precipPct, ventKmh : valeur par modèle (array, un par modèle, au
// même instant, même ordre que labelsModeles). poids : même longueur,
// optionnel (défaut 1 partout). Renvoie { score, sousScores, niveau, texte,
// details, moyennes }.
export function calculerConfiance({ tempsC = [], precipPct = [], ventKmh = [], labelsModeles = [], poids = null }) {
  const details = [];

  const ecartTemp = ecartPondere(tempsC, poids);
  const sTemp = score(ecartTemp, 5, 0.3);
  details.push({
    label: ecartTemp < 1 ? `Températures très proches (±${ecartTemp.toFixed(1)} °C)` : ecartTemp < 3 ? `Petit écart de température entre modèles (${ecartTemp.toFixed(1)} °C)` : `Températures qui divergent nettement (jusqu'à ${ecartTemp.toFixed(1)} °C d'écart)`,
    points: sTemp >= 70 ? 1 : sTemp >= 40 ? 0 : -1,
  });
  const isoleTemp = detecterModeleIsole(tempsC, labelsModeles, 4);
  if (isoleTemp) details.push({ label: `${isoleTemp} s'écarte nettement des 3 autres modèles sur la température`, points: -1 });

  const ecartPrecip = ecartPondere(precipPct, poids);
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

  const ecartVent = ecartPondere(ventKmh, poids);
  const sVent = ventKmh.length ? score(ecartVent, 30, 3) : 100;
  if (ventKmh.length) {
    details.push({
      label: ecartVent < 8 ? "Vent estimé de façon cohérente" : `Vent estimé différemment selon les modèles (±${Math.round(ecartVent)} km/h)`,
      points: sVent >= 70 ? 1 : sVent >= 40 ? 0 : -1,
    });
  }

  let total = Math.round(sTemp * 0.4 + sPrecip * 0.45 + sVent * 0.15);
  if (desaccordPluie) total = Math.min(total, 60); // un vrai désaccord pluie/pas pluie plafonne la confiance
  if (isoleTemp) total = Math.min(total, 70);

  const niveau = total >= 75 ? "haute" : total >= 50 ? "moyenne" : "basse";
  const texte = total >= 75 ? "Modèles fortement concordants." : total >= 50 ? "Modèles globalement d'accord, quelques nuances." : "Modèles divergents : à prendre avec prudence.";

  return {
    score: total,
    sousScores: { temperature: sTemp, pluie: sPrecip, vent: ventKmh.length ? sVent : null },
    niveau,
    texte,
    details,
    moyenneTemp: moyennePonderee(tempsC, poids),
    moyennePrecip: moyenne(precipPct),
    moyenneVent: moyenne(ventKmh),
  };
}

// Poids par modèle selon l'échéance : AROME (meteofrance_seamless, indice 0
// dans MODELES -- voir config.js) compte double dans les 48 premières
// heures, où sa haute résolution locale est la plus fiable.
export function poidsModeles(nbModeles, heuresDepuisMaintenant) {
  const poids = new Array(nbModeles).fill(1);
  // Poids 2 jusqu'à 24h, puis redescend en douceur jusqu'à 1 vers 72h --
  // plus réaliste qu'un simple seuil brutal à 48h (la confiance qu'on peut
  // avoir en AROME ne s'effondre pas d'un coup à l'heure 49).
  if (heuresDepuisMaintenant <= 24) poids[0] = 2;
  else if (heuresDepuisMaintenant < 72) poids[0] = 2 - (heuresDepuisMaintenant - 24) / 48;
  return poids;
}

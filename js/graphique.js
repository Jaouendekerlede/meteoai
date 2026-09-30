// Graphique SVG (courbe lissée + aire dégradée), sans bibliothèque externe.
// Un seul but : rester léger et cohérent avec le reste de l'appli.

const H = 180;
const MARGE = { haut: 24, bas: 28, gauche: 8, droite: 8 };

function lisserChemin(pts) {
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i === 0 ? 0 : i - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2] || pts[i + 1];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  }
  return d;
}

// valeurs : number[] (une par heure/jour) ; etiquettes : string[] (même
// longueur) ; indexMaintenant : surligné d'un trait + point ; unite pour les
// repères min/max ; couleur : dégradé CSS (ex. "#4fe0ff").
export function courbe({ valeurs, etiquettes, indexMaintenant = -1, unite = "", couleur = "#4fe0ff", largeur = 600, pasEtiquette = 3 }) {
  const v = valeurs.map((x) => (Number.isFinite(x) ? x : null));
  const finies = v.filter((x) => x !== null);
  if (!finies.length) return "";
  const min = Math.min(...finies);
  const max = Math.max(...finies);
  const ecart = max - min || 1;
  const zoneH = H - MARGE.haut - MARGE.bas;
  const zoneL = largeur - MARGE.gauche - MARGE.droite;
  const pasX = zoneL / Math.max(1, v.length - 1);
  const idGrad = `grad-${Math.random().toString(36).slice(2, 8)}`;

  const pts = v.map((val, i) => [MARGE.gauche + i * pasX, val === null ? null : MARGE.haut + zoneH - ((val - min) / ecart) * zoneH]);
  const ptsValides = pts.filter((p) => p[1] !== null);
  const chemin = lisserChemin(ptsValides);
  const aire = `${chemin} L${ptsValides[ptsValides.length - 1][0]},${MARGE.haut + zoneH} L${ptsValides[0][0]},${MARGE.haut + zoneH} Z`;

  const etiquettesHtml = etiquettes
    .map((t, i) => (i % pasEtiquette === 0 || i === v.length - 1 ? `<text x="${MARGE.gauche + i * pasX}" y="${H - 8}" font-size="10" fill="var(--texte-att)" text-anchor="middle">${t}</text>` : ""))
    .join("");

  const maintenantHtml =
    indexMaintenant >= 0 && pts[indexMaintenant]?.[1] !== null
      ? `<line x1="${pts[indexMaintenant][0]}" y1="${MARGE.haut}" x2="${pts[indexMaintenant][0]}" y2="${MARGE.haut + zoneH}" stroke="var(--texte-att)" stroke-width="1" stroke-dasharray="3,3"/>
         <circle cx="${pts[indexMaintenant][0]}" cy="${pts[indexMaintenant][1]}" r="4.5" fill="${couleur}" stroke="var(--fond-carte)" stroke-width="2"/>`
      : "";

  return `<svg viewBox="0 0 ${largeur} ${H}" width="100%" height="${H}" preserveAspectRatio="none" class="ma-graphique">
    <defs><linearGradient id="${idGrad}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${couleur}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${couleur}" stop-opacity="0"/>
    </linearGradient></defs>
    <text x="${MARGE.gauche}" y="${MARGE.haut - 8}" font-size="11" fill="var(--texte)" font-weight="700">${Math.round(max)}${unite}</text>
    <text x="${MARGE.gauche}" y="${MARGE.haut + zoneH + 2}" font-size="11" fill="var(--texte-att)" font-weight="700">${Math.round(min)}${unite}</text>
    <path d="${aire}" fill="url(#${idGrad})" stroke="none"/>
    <path d="${chemin}" fill="none" stroke="${couleur}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${maintenantHtml}
    ${etiquettesHtml}
  </svg>`;
}

// Température (courbe, zone haute) + précipitations (barres, zone basse) sur
// le même axe des temps -- lecture d'un coup d'œil, comme les apps pro.
export function courbeCombinee({ temperatures, precipitations, etiquettes, indexMaintenant = -1, largeur = 600, pasEtiquette = 3 }) {
  const t = temperatures.map((x) => (Number.isFinite(x) ? x : null));
  const finies = t.filter((x) => x !== null);
  if (!finies.length) return "";
  const min = Math.min(...finies);
  const max = Math.max(...finies);
  const ecart = max - min || 1;
  const zoneL = largeur - MARGE.gauche - MARGE.droite;
  const pasX = zoneL / Math.max(1, t.length - 1);
  const hautTemp = { haut: 20, bas: 86 };
  const zoneTempH = H - hautTemp.haut - hautTemp.bas;
  const zonePluie = { haut: H - 70, bas: 28 };
  const zonePluieH = H - zonePluie.haut - zonePluie.bas;
  const maxPluie = Math.max(1, ...precipitations.filter(Number.isFinite));

  const pts = t.map((val, i) => [MARGE.gauche + i * pasX, val === null ? null : hautTemp.haut + zoneTempH - ((val - min) / ecart) * zoneTempH]);
  const ptsValides = pts.filter((p) => p[1] !== null);
  const chemin = lisserChemin(ptsValides);

  const largeurBarre = Math.max(2, pasX * 0.5);
  const barres = precipitations
    .map((p, i) => {
      if (!Number.isFinite(p) || p <= 0) return "";
      const h = (p / maxPluie) * zonePluieH;
      const x = MARGE.gauche + i * pasX - largeurBarre / 2;
      return `<rect x="${x}" y="${zonePluie.haut + zonePluieH - h}" width="${largeurBarre}" height="${h}" rx="1.5" fill="var(--accent)" opacity="0.55"/>`;
    })
    .join("");

  const etiquettesHtml = etiquettes
    .map((tt, i) => (i % pasEtiquette === 0 || i === t.length - 1 ? `<text x="${MARGE.gauche + i * pasX}" y="${H - 8}" font-size="10" fill="var(--texte-att)" text-anchor="middle">${tt}</text>` : ""))
    .join("");

  const maintenantHtml =
    indexMaintenant >= 0 && pts[indexMaintenant]?.[1] !== null
      ? `<line x1="${pts[indexMaintenant][0]}" y1="${hautTemp.haut}" x2="${pts[indexMaintenant][0]}" y2="${zonePluie.haut + zonePluieH}" stroke="var(--texte-att)" stroke-width="1" stroke-dasharray="3,3"/>
         <circle cx="${pts[indexMaintenant][0]}" cy="${pts[indexMaintenant][1]}" r="4.5" fill="#ffc857" stroke="var(--fond-carte)" stroke-width="2"/>`
      : "";

  return `<svg viewBox="0 0 ${largeur} ${H}" width="100%" height="${H}" preserveAspectRatio="none" class="ma-graphique">
    <text x="${MARGE.gauche}" y="${hautTemp.haut - 6}" font-size="11" fill="var(--texte)" font-weight="700">${Math.round(max)}°</text>
    <text x="${MARGE.gauche}" y="${hautTemp.haut + zoneTempH + 2}" font-size="11" fill="var(--texte-att)" font-weight="700">${Math.round(min)}°</text>
    ${barres}
    <path d="${chemin}" fill="none" stroke="#ffc857" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${maintenantHtml}
    ${etiquettesHtml}
  </svg>`;
}

// Comparaison de plusieurs modèles superposés (même unité) -- pour voir
// l'enveloppe d'incertitude d'un coup d'œil, sans devoir dérouler le détail.
// series : [{ valeurs: number[], couleur: "#..." }].
export function courbeMultiple({ series, etiquettes, indexMaintenant = -1, unite = "", largeur = 600, pasEtiquette = 3 }) {
  const toutesValeurs = series.flatMap((s) => s.valeurs.filter(Number.isFinite));
  if (!toutesValeurs.length) return "";
  const min = Math.min(...toutesValeurs);
  const max = Math.max(...toutesValeurs);
  const ecart = max - min || 1;
  const zoneH = H - MARGE.haut - MARGE.bas;
  const zoneL = largeur - MARGE.gauche - MARGE.droite;
  const n = etiquettes.length;
  const pasX = zoneL / Math.max(1, n - 1);

  const lignes = series
    .map((s) => {
      const pts = s.valeurs.map((val, i) => [MARGE.gauche + i * pasX, Number.isFinite(val) ? MARGE.haut + zoneH - ((val - min) / ecart) * zoneH : null]).filter((p) => p[1] !== null);
      if (pts.length < 2) return "";
      return `<path d="${lisserChemin(pts)}" fill="none" stroke="${s.couleur}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
    })
    .join("");

  const etiquettesHtml = etiquettes
    .map((t, i) => (i % pasEtiquette === 0 || i === n - 1 ? `<text x="${MARGE.gauche + i * pasX}" y="${H - 8}" font-size="10" fill="var(--texte-att)" text-anchor="middle">${t}</text>` : ""))
    .join("");

  const traitMaintenant = indexMaintenant >= 0 ? `<line x1="${MARGE.gauche + indexMaintenant * pasX}" y1="${MARGE.haut}" x2="${MARGE.gauche + indexMaintenant * pasX}" y2="${MARGE.haut + zoneH}" stroke="var(--texte-att)" stroke-width="1" stroke-dasharray="3,3"/>` : "";

  return `<svg viewBox="0 0 ${largeur} ${H}" width="100%" height="${H}" preserveAspectRatio="none" class="ma-graphique">
    <text x="${MARGE.gauche}" y="${MARGE.haut - 8}" font-size="11" fill="var(--texte)" font-weight="700">${Math.round(max)}${unite}</text>
    <text x="${MARGE.gauche}" y="${MARGE.haut + zoneH + 2}" font-size="11" fill="var(--texte-att)" font-weight="700">${Math.round(min)}${unite}</text>
    ${traitMaintenant}
    ${lignes}
    ${etiquettesHtml}
  </svg>`;
}

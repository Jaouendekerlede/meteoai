// Icônes météo (SVG en ligne, tracé façon Feather -- cohérent, léger, se
// colore avec `currentColor`) et traduction des codes officiels WMO
// (utilisés par Open-Meteo) en icône + texte français.

const NUAGE = '<path d="M6.5 19a4.5 4.5 0 0 1-.5-8.98A5.5 5.5 0 0 1 16.9 8.02 4 4 0 0 1 17 16H6.5Z"/>';

const ICONES = {
  soleil: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8"/>',
  lune: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  "nuage-soleil": '<circle cx="8" cy="8" r="3.2"/><path d="M8 3v1.6M8 12.4V14M3 8h1.6M12.4 8H14M4.3 4.3l1.1 1.1M11.7 4.3l-1.1 1.1"/>' + '<path d="M9 19a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-1.8A3.6 3.6 0 0 1 17.6 16H9Z" transform="translate(1.5 1)"/>',
  "nuage-lune": '<path d="M15.5 4.2A5.5 5.5 0 1 1 8.9 11a4.4 4.4 0 0 0 6.6-6.8Z" transform="scale(.72) translate(1 2)"/>' + '<path d="M9 19a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-1.8A3.6 3.6 0 0 1 17.6 16H9Z" transform="translate(1.5 2)"/>',
  nuage: NUAGE,
  brouillard: '<path d="M4 8h11M2.5 11.5h16M4 15h11M2.5 18.5h16"/>',
  bruine: NUAGE + '<path d="M8 20.5v1.2M12 20.5v1.2M16 20.5v1.2" stroke-linecap="round"/>',
  pluie: NUAGE + '<path d="M7.5 20v2M12 20v2M16.5 20v2" stroke-linecap="round"/>',
  "pluie-forte": NUAGE + '<path d="M7 19.5 6 23M11.5 19.5l-1 3.5M16 19.5l-1 3.5" stroke-linecap="round"/>',
  averses: '<path d="M8 12.5a3.2 3.2 0 0 1-.3-6.4A4.4 4.4 0 0 1 16 5" transform="translate(0 -1)"/>' + NUAGE + '<path d="M7.5 20v2M12 20v2M16.5 20v2" stroke-linecap="round"/>',
  neige: NUAGE + '<path d="M8 20v3M8 20.3l-1.3 1M8 20.3l1.3 1M8 22.7l-1.3-1M8 22.7l1.3-1M16 20v3M16 20.3l-1.3 1M16 20.3l1.3 1M16 22.7l-1.3-1M16 22.7l1.3-1" stroke-linecap="round"/>',
  orage: NUAGE + '<path d="M11 19.5 9 23h3l-1.5 3" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function icone(nom, taille = 24) {
  const chemin = ICONES[nom] || ICONES.nuage;
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${chemin}</svg>`;
}

// code WMO -> { icone, texte }. estJour : 0/1 (renvoyé par Open-Meteo).
export function infoCode(code, estJour = 1) {
  const jour = estJour !== 0;
  const table = {
    0: { icone: jour ? "soleil" : "lune", texte: "Ciel dégagé" },
    1: { icone: jour ? "soleil" : "lune", texte: "Généralement clair" },
    2: { icone: jour ? "nuage-soleil" : "nuage-lune", texte: "Partiellement nuageux" },
    3: { icone: "nuage", texte: "Couvert" },
    45: { icone: "brouillard", texte: "Brouillard" },
    48: { icone: "brouillard", texte: "Brouillard givrant" },
    51: { icone: "bruine", texte: "Bruine légère" },
    53: { icone: "bruine", texte: "Bruine" },
    55: { icone: "bruine", texte: "Bruine dense" },
    56: { icone: "bruine", texte: "Bruine verglaçante" },
    57: { icone: "bruine", texte: "Bruine verglaçante dense" },
    61: { icone: "pluie", texte: "Pluie légère" },
    63: { icone: "pluie", texte: "Pluie modérée" },
    65: { icone: "pluie-forte", texte: "Pluie forte" },
    66: { icone: "pluie", texte: "Pluie verglaçante" },
    67: { icone: "pluie-forte", texte: "Pluie verglaçante forte" },
    71: { icone: "neige", texte: "Neige légère" },
    73: { icone: "neige", texte: "Neige modérée" },
    75: { icone: "neige", texte: "Neige forte" },
    77: { icone: "neige", texte: "Neige en grains" },
    80: { icone: "averses", texte: "Averses légères" },
    81: { icone: "averses", texte: "Averses" },
    82: { icone: "pluie-forte", texte: "Averses violentes" },
    85: { icone: "neige", texte: "Averses de neige" },
    86: { icone: "neige", texte: "Averses de neige fortes" },
    95: { icone: "orage", texte: "Orage" },
    96: { icone: "orage", texte: "Orage avec grêle" },
    99: { icone: "orage", texte: "Orage violent avec grêle" },
  };
  return table[code] || { icone: "nuage", texte: "—" };
}

// HTML des articles : un seul assainissement (docs/ARTICLES.md § 5), utilisé à l'enregistrement, à l'affichage
// et plus tard à l'import et aux pages publiques. Testé par npm test (tests/articles-assainir.test.mjs, avec jsdom).
// - retirés : <style>, <script>, <link>, <meta>, formulaires, attributs on…, liens javascript: (DOMPurify) ;
// - style="" : seules text-align et direction gardées (couleurs et fonds codés en dur illisibles en thème sombre) ;
// - <iframe> : seulement les vidéos YouTube, réécrites vers youtube-nocookie.com ;
// - liens externes : nouvel onglet, rel="noopener noreferrer".

const INTERDITS = ['style', 'script', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'option',
  'object', 'embed', 'frame', 'frameset', 'noscript', 'template'];
const STYLES_GARDES = new Set(['text-align', 'direction']);

// Identifiant d'une vidéo YouTube à partir de l'adresse d'un cadre intégré, sinon ''.
export function videoYoutube(src) {
  let u;
  try { u = new URL(String(src ?? ''), 'https://x.invalid'); } catch { return ''; }
  const hote = u.hostname.replace(/^www\./, '');
  let id = '';
  if (['youtube.com', 'youtube-nocookie.com', 'm.youtube.com'].includes(hote)) {
    const m = u.pathname.match(/^\/embed\/([\w-]{6,20})$/);
    if (m) id = m[1];
    else if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
  } else if (hote === 'youtu.be') id = u.pathname.slice(1);
  return /^[\w-]{6,20}$/.test(id) ? id : '';
}

// Ne garde que text-align et direction d'un attribut style.
export function filtrerStyle(style) {
  return String(style ?? '').split(';').map((d) => d.trim()).filter(Boolean)
    .map((d) => { const i = d.indexOf(':'); return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]; })
    .filter((p) => p && STYLES_GARDES.has(p[0]) && /^[a-z-]+$/i.test(p[1]))
    .map(([k, v]) => `${k}: ${v}`).join('; ');
}

// Prépare une instance de DOMPurify (navigateur ou jsdom) et retourne la fonction d'assainissement.
export function creerAssainisseur(DOMPurify) {
  DOMPurify.addHook('uponSanitizeElement', (noeud, data) => {
    if (data.tagName !== 'iframe') return;
    const id = videoYoutube(noeud.getAttribute('src'));
    if (!id) { noeud.parentNode?.removeChild(noeud); return; }
    for (const a of [...noeud.attributes]) noeud.removeAttribute(a.name);
    noeud.setAttribute('src', `https://www.youtube-nocookie.com/embed/${id}`);
    noeud.setAttribute('allowfullscreen', '');
    noeud.setAttribute('loading', 'lazy');
    noeud.setAttribute('title', 'Vidéo YouTube');
  });
  DOMPurify.addHook('afterSanitizeAttributes', (noeud) => {
    if (noeud.hasAttribute?.('style')) {
      const garde = filtrerStyle(noeud.getAttribute('style'));
      if (garde) noeud.setAttribute('style', garde); else noeud.removeAttribute('style');
    }
    if (noeud.tagName === 'A' && /^https?:/i.test(noeud.getAttribute('href') || '')) {
      noeud.setAttribute('target', '_blank');
      noeud.setAttribute('rel', 'noopener noreferrer');
    }
  });
  const config = {
    FORBID_TAGS: INTERDITS,
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allowfullscreen', 'loading', 'target'],
    FORBID_ATTR: ['srcset'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|#|\/|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  };
  return (html) => DOMPurify.sanitize(String(html ?? ''), config);
}

// Navigateur : DOMPurify servi par l'application (vendor/), chargé à la première utilisation.
let pret = null;
export function assainisseur() {
  if (!pret) {
    pret = import('../vendor/dompurify/purify.es.js').then((m) => creerAssainisseur(m.default))
      .catch((e) => { pret = null; throw e; });
  }
  return pret;
}

// Texte brut d'un HTML (résumé, recherche) : sans balises, espaces simples.
export function texteBrut(html) {
  return String(html ?? '').replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
}

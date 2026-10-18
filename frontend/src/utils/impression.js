// Impression d'un rapport SEUL.
//
// window.print() dans l'application imprimait toute la page (menu, en-tête,
// barre du bas) et le navigateur ajoutait en marge l'adresse du serveur
// (IP), la date et le titre. Ici le rapport est imprimé depuis un cadre
// invisible qui ne contient QUE le rapport, avec des marges de page à zéro :
// le navigateur n'a plus de place pour ses en-têtes/pieds (adresse IP).
// Les marges réelles sont recréées par un padding répété sur chaque page.

const CSS_IMPRESSION = `
@page { size: A4; margin: 0; }
@media print {
  html, body { margin: 0 !important; background: #fff !important; }
  body {
    padding: 12mm 12mm 14mm !important;
    -webkit-box-decoration-break: clone; box-decoration-break: clone;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .no-print { display: none !important; }
}`

/** Ajoute à un document HTML les règles d'impression (pas d'adresse IP en marge). */
export function documentComplet(html, titre) {
  const style = `<style>${CSS_IMPRESSION}</style>`
  if (/<html[\s>]/i.test(html)) {
    let doc = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${style}</head>`) : html.replace(/<body/i, `<head>${style}</head><body`)
    if (titre) doc = doc.replace(/<title>[\s\S]*?<\/title>/i, `<title>${titre}</title>`)
    return doc
  }
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${titre || 'Rapport'}</title>`
    + `<style>body{font-family:Inter,Arial,sans-serif;color:#0f172a}</style>${style}</head><body>${html}</body></html>`
}

/** Imprime un document HTML (complet ou fragment) sans le reste de l'application. */
export function imprimerHtml(html, titre) {
  const cadre = document.createElement('iframe')
  cadre.setAttribute('aria-hidden', 'true')
  Object.assign(cadre.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(cadre)
  const doc = cadre.contentDocument
  doc.open(); doc.write(documentComplet(html, titre)); doc.close()
  let lance = false
  const lancer = () => {
    if (lance) return
    lance = true
    try { cadre.contentWindow.focus(); cadre.contentWindow.print() } catch { /* ignore */ }
    setTimeout(() => cadre.remove(), 60000)
  }
  // Laisse le temps aux images (photos, logos) de se charger.
  const imgs = [...doc.images].filter(i => !i.complete)
  if (!imgs.length) setTimeout(lancer, 250)
  else {
    let reste = imgs.length
    const fin = () => { if (--reste === 0) setTimeout(lancer, 100) }
    imgs.forEach(i => { i.onload = fin; i.onerror = fin })
    setTimeout(lancer, 4000)
  }
}

/** Imprime un élément affiché à l'écran (avec les styles de l'application). */
export function imprimerElement(el, titre) {
  if (!el) return
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('')
  imprimerHtml(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${titre || 'Rapport'}</title>${styles}</head>`
    + `<body style="background:#fff">${el.outerHTML}</body></html>`, titre)
}

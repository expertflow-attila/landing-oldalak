// "Kell-e egyáltalán újonnan?" — használt piac, javítás, kölcsönzés
// ugyanarra az igényre, mielőtt új terméket vennél.

export interface AlternativeLink {
  label: string
  url: string
}

export function vintedUrl(query: string): string {
  return `https://www.vinted.hu/catalog?search_text=${encodeURIComponent(query)}`
}

export function jofogasUrl(query: string): string {
  return `https://www.jofogas.hu/magyarorszag?q=${encodeURIComponent(query)}`
}

export function marketplaceUrl(query: string): string {
  return `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(query)}`
}

export function hasznaltautoUrl(query: string): string {
  return `https://www.hasznaltauto.hu/talalatilista?kereses=${encodeURIComponent(query)}`
}

export function searchLinks(query: string): AlternativeLink[] {
  return [
    { label: 'Vinted (használt ruha, cipő)', url: vintedUrl(query) },
    { label: 'Jófogás (használt bármi)', url: jofogasUrl(query) },
    { label: 'Facebook Marketplace', url: marketplaceUrl(query) },
  ]
}

/** Kategórianév-kulcsszavak alapján statikus tippek. */
export function staticTips(categoryName: string | undefined): string[] {
  const n = (categoryName ?? '').toLowerCase()
  if (n.includes('ruházat') || n.includes('cipő')) {
    return [
      'Nézd meg használtan — a ruhák értékvesztése az első viselés után a legnagyobb.',
      'Ha egy meglévő darab hibás: varrónő / cipész gyakran pár ezer forintból megoldja.',
    ]
  }
  if (n.includes('hobbi') || n.includes('háztartás') || n.includes('lakásdekor')) {
    return [
      'Szerszámot, eszközt ritkán használsz? Kölcsönzés vagy kölcsönkérés olcsóbb, mint megvenni.',
      'Könyvet a könyvtár, társasjátékot játékkölcsönző is adhat.',
    ]
  }
  if (n.includes('szórakozás') || n.includes('elektronika')) {
    return [
      'Elektronikánál a felújított (refurbished) darab 20–40%-kal olcsóbb, garanciával.',
      'A meglévő készüléked javítása gyakran töredéke az új árának.',
    ]
  }
  return [
    'Kérdezd meg magadtól: a meglévő megoldásod tényleg nem elég?',
    'Használtan ugyanez jellemzően 30–60%-kal olcsóbb.',
  ]
}

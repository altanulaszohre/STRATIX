const paths: Record<string,string> = {
  play:'<path fill="currentColor" stroke="none" d="M6 3.6a1 1 0 0 1 1.5-.85l13.2 8.4a1 1 0 0 1 0 1.7l-13.2 8.4a1 1 0 0 1-1.5-.85Z"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',
  hand:'<path d="M7.7 12.7V6a1.4 1.4 0 0 1 2.8 0v5-7a1.4 1.4 0 0 1 2.8 0v7-6a1.4 1.4 0 0 1 2.8 0v7-4a1.4 1.4 0 0 1 2.8 0v7c0 4.6-2.8 7-6.1 7-2.2 0-3.7-.9-5.1-2.5L3.5 13a1.5 1.5 0 0 1 2.2-2z"/>',
  keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5.5 9h1m3 0h1m3 0h1m3 0h1m-13 3h1m3 0h1m3 0h1m3 0h1m-10 3h7"/>',
  trophy:'<path d="M7 3h10v5c0 4-1.8 6-5 6s-5-2-5-6zM7 5H3v2c0 3 2 4 5 4m9-6h4v2c0 3-2 4-5 4m-4 3v5m-4 2h8m-6-2h4"/>',
  settings:'<path d="m10 3-.6 2.3-2 .9-2.1-.7-2 3.3 1.6 1.6v2.4L3.3 15l2 3.3 2.2-.8 2 .9.5 2.6h4l.6-2.5 2-.9 2.2.7 1.9-3.3-1.6-1.7v-2.5l1.6-1.7-2-3.2-2.2.7-2-.9L14 3z"/><circle cx="12" cy="12" r="3"/>',
  book:'<path d="M12 6c-3.3-2.2-6.6-2.3-10-1v14c3.5-1.3 6.8-1.2 10 1 3.2-2.2 6.5-2.3 10-1V5c-3.4-1.3-6.7-1.2-10 1zm0 0v14"/>',
  sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8c2.3 2.6 2.3 5.4 0 8m3-11c4 4 4 10 0 14"/>',
  mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  full:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
  pause:'<path stroke-width="4" d="M8 5v14m8-14v14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2.2"/>',
  plane:'<path d="m2 15 8-3 6-8c1.8-2 4.5-.8 3.2 1.5L15 12l6 4-1 2-8-2-4 4-2-1 2-4-5 2z"/>',
  mountain:'<path d="m2 20 8-14 4 7 2-4 6 11zM7.1 11.1 10 13l2-2"/>',
  cam:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
  enter:'<path d="M20 5v8H5m5-5-5 5 5 5"/>',retry:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',glide:'<path d="M2 17q5-12 10-7t10-5m-6 0h6v6"/>',
  home:'<path d="m2 11 10-8 10 8M5 10v11h5v-7h4v7h5V10"/>',
  sun:'<path d="M3 16h18M6 20h12M7 15a5 5 0 0 1 10 0M12 3v3M3 8l2 2m14 0 2-2"/>'
}
export function icon(name: string, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`
}

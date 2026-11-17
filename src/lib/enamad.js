/**
 * The Enamad (electronic trust symbol, enamad.ir) seal, shown on the PERSIAN pages only.
 * The code below is the public seal code Enamad issued for this site; it is not a secret.
 * enamadHtml() returns Enamad's snippet exactly as they give it. It is written into the static /fa/ page by
 * scripts/postbuild.mjs (so Enamad's checker finds it in the page's HTML) and by <EnamadSeal> for visitors who reach
 * Persian by switching language. If you change the site's address in Enamad, replace the two values here.
 */
export const ENAMAD = { id: '8445411', code: 'K5Y2bD303AnVuuikbflElWHfWwWIEgam' };

export const enamadHtml = () =>
  `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=${ENAMAD.id}&Code=${ENAMAD.code}'>` +
  `<img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=${ENAMAD.id}&Code=${ENAMAD.code}' alt='' style='cursor:pointer' code='${ENAMAD.code}'></a>`;

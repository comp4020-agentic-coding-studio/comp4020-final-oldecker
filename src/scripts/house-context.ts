// Which house this page is, for every client script that talks to the API.
// The house page renders <body data-house="<slug>">; every fetch names the
// house explicitly through houseUrl() --- never "whatever house you were
// last in" --- so a tab left open on one house can't write into another.
export const houseSlug = document.body.dataset.house ?? "";

export function houseUrl(path: string): string {
  return `${path}?${new URLSearchParams({ house: houseSlug })}`;
}

// For building HTML strings out of user-supplied text (names), on the server
// or in the browser alike. Every name that goes into an innerHTML or a
// set:html string goes through this first.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

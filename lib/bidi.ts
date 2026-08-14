/**
 * Embed a Latin/English fragment so the browser keeps LTR word order
 * inside an RTL page (unicode-bidi isolate).
 */
export function ltrEmbed(text: string): string {
  return `\u2066${text}\u2069`
}

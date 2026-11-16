// Locate the editable text elements of a slide file, deterministically.
// Shared by build.mjs (tags them with data-e) and serve.mjs (writes edits back),
// so the n-th editable element is always the same node in both.
//
// "Editable" = an element that holds visible text directly (a non-blank text node
// as a direct child) and whose ancestors are not editable already. Content inside
// <script>, <style>, <template>, <svg>, <textarea> is never editable.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "template", "svg", "textarea"]);
const NOT_EDITABLE = new Set(["section", "body", "html", "ul", "ol", "table", "thead", "tbody", "tr", "video", "audio", "canvas", "select"]);
const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;

export function findEditables(html) {
  const nodes = [];
  const stack = [];
  let last = 0, m;
  TAG.lastIndex = 0;
  const text = (from, to) => {
    if (!stack.length) return;
    const t = html.slice(from, to).replace(/&nbsp;/g, " ");
    if (/\S/.test(t)) stack[stack.length - 1].hasText = true;
  };
  while ((m = TAG.exec(html))) {
    text(last, m.index);
    last = TAG.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    const closing = m[1] === "/", tag = m[2].toLowerCase(), selfClose = m[4] === "/";
    if (!closing) {
      if (VOID.has(tag) || selfClose) continue;
      if (RAW.has(tag)) {                                   // skip the whole raw block
        const end = html.toLowerCase().indexOf("</" + tag, TAG.lastIndex);
        if (end < 0) break;
        TAG.lastIndex = html.indexOf(">", end) + 1;
        last = TAG.lastIndex;
        continue;
      }
      const node = { tag, openStart: m.index, openEnd: TAG.lastIndex - 1 - (m[0].endsWith("/>") ? 1 : 0), contentStart: TAG.lastIndex, contentEnd: -1, hasText: false, parent: stack[stack.length - 1] || null };
      nodes.push(node);
      stack.push(node);
    } else {
      let i = stack.length - 1;
      while (i >= 0 && stack[i].tag !== tag) i--;
      if (i < 0) continue;                                  // stray close tag
      for (let k = stack.length - 1; k >= i; k--) stack[k].contentEnd = stack[k].contentEnd < 0 ? m.index : stack[k].contentEnd;
      stack.length = i;
    }
  }
  const editable = [];
  for (const n of nodes) {
    if (!n.hasText || n.contentEnd < 0 || NOT_EDITABLE.has(n.tag)) continue;
    let p = n.parent, inside = false;
    while (p) { if (p.editable) { inside = true; break; } p = p.parent; }
    if (inside) continue;
    n.editable = true;
    editable.push(n);
  }
  return editable; // document order
}

/** Tag every editable element with data-e="<key>#<n>". */
export function annotate(html, key) {
  const eds = findEditables(html);
  let out = html;
  for (let n = eds.length - 1; n >= 0; n--) {
    const at = eds[n].openEnd;                              // index of the opening tag's ">"
    out = out.slice(0, at) + ` data-e="${key}#${n}"` + out.slice(at);
  }
  return out;
}

/** Replace the inner HTML of editable #n for each edit {n, html}. */
export function applyEdits(html, edits) {
  const eds = findEditables(html);
  const sorted = [...edits].sort((a, b) => b.n - a.n);
  let out = html;
  for (const e of sorted) {
    const node = eds[e.n];
    if (!node) throw new Error("editable #" + e.n + " not found");
    out = out.slice(0, node.contentStart) + e.html + out.slice(node.contentEnd);
  }
  return out;
}

/** Replace the speaker notes (<template class="notes">…</template>). */
export function setNotes(html, notes) {
  const esc = notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const re = /(<template class="notes">)([\s\S]*?)(<\/template>)/;
  if (re.test(html)) return html.replace(re, (_, a, _b, c) => a + esc + c);
  return html.replace(/(<section[^>]*>)/, `$1\n  <template class="notes">${esc}</template>`);
}

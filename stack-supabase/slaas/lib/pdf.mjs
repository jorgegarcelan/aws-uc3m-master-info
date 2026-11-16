// Write a PDF with one full-page JPEG per slide (no dependencies).
export function jpegsToPdf(jpegs, { width = 1920, height = 1080, pageW = 960, pageH = 540 } = {}) {
  const chunks = [], xref = [];
  let offset = 0;
  const push = (b) => { const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b; chunks.push(buf); offset += buf.length; };
  const obj = (n, parts) => { xref[n] = offset; push(`${n} 0 obj\n`); parts.forEach(push); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const pageIds = jpegs.map((_, i) => 3 + i * 3);
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${jpegs.length} >>`]);
  jpegs.forEach((jpg, i) => {
    const p = pageIds[i], c = p + 1, im = p + 2;
    obj(p, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${c} 0 R >>`]);
    const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im${i} Do Q`;
    obj(c, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    obj(im, [`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, "\nendstream"]);
  });
  const total = 3 + jpegs.length * 3, xrefAt = offset;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(String(xref[i]).padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

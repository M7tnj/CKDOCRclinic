/**
 * Minimal, dependency-free .xlsx writer.
 * Produces a genuine Excel 2007+ workbook (one worksheet, header row styled,
 * frozen first row, autofilter) using a hand-rolled ZIP container with
 * uncompressed (store) entries — no external library needed on GitHub Pages.
 */

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- tiny ZIP (store method) ---------- */
function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...nameBytes,
    ]);
    chunks.push(local, data);
    central.push({
      nameBytes, crc, size: data.length, offset,
    });
    offset += local.length + data.length;
  }

  const centralStart = offset;
  for (const c of central) {
    const rec = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset),
      ...c.nameBytes,
    ]);
    chunks.push(rec);
    offset += rec.length;
  }

  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(offset - centralStart), ...u32(centralStart), ...u16(0),
  ]);
  chunks.push(end);

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

/* ---------- XLSX parts ---------- */

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colName(i) {
  let s = "";
  i += 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function sheetXml(header, rows) {
  const cell = (v, r, c) => {
    if (v === "" || v === null || v === undefined) return "";
    const ref = `${colName(c)}${r}`;
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
  };
  const rowXml = (vals, r) => `<row r="${r}">${vals.map((v, c) => cell(v, r, c)).join("")}</row>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<sheetData>${rowXml(header, 1)}${rows.map((r, i) => rowXml(r, i + 2)).join("")}</sheetData>` +
    `<autoFilter ref="A1:${colName(header.length - 1)}${rows.length + 1}"/>` +
    `</worksheet>`
  );
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="Patient Data" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const WB_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>` +
  `</styleSheet>`;

/**
 * Build and download an .xlsx file.
 * @param {string[]} header
 * @param {(string|number)[][]} rows
 * @param {string} filename
 */
export function downloadXlsx(header, rows, filename) {
  const enc = new TextEncoder();
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(RELS) },
    { name: "xl/workbook.xml", data: enc.encode(WORKBOOK) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(WB_RELS) },
    { name: "xl/styles.xml", data: enc.encode(STYLES) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml(header, rows)) },
  ];
  const zip = zipStore(files);
  const blob = new Blob([zip], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** RFC 4180 CSV with BOM so Excel opens UTF-8 correctly. */
export function downloadCsv(header, rows, filename) {
  const esc = (v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  triggerDownload(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv; charset=utf-8" }), filename);
}

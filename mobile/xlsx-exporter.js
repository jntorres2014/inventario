(function () {
  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255]);
  }

  function u32(value) {
    return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
  }

  function join(parts) {
    const length = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  function dosTime(date) {
    return ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() / 2) & 31);
  }

  function dosDate(date) {
    return (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
  }

  function zip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    const now = new Date();
    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const crc = crc32(data);
      const local = join([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime(now)), u16(dosDate(now)),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
      ]);
      locals.push(local);
      centrals.push(join([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime(now)), u16(dosDate(now)),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0),
        u16(0), u32(0), u32(offset), name
      ]));
      offset += local.length;
    }
    const centralData = join(centrals);
    const end = join([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(centralData.length), u32(offset), u16(0)
    ]);
    return new Blob([...locals, centralData, end], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  function xml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
    })[char]);
  }

  function cell(ref, value, style = 0) {
    return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }

  function columnName(index) {
    let name = "";
    while (index > 0) { index -= 1; name = String.fromCharCode(65 + (index % 26)) + name; index = Math.floor(index / 26); }
    return name;
  }

  window.exportInventoryXlsx = function exportInventoryXlsx(records) {
    const headers = ["Numero Inventario", "Fecha y hora", "Operador", "Sector", "Repetido"];
    const rows = [headers, ...records.map((record) => [
      record.code, record.timestamp, record.operator, record.sector, record.repeated ? "SI" : "NO"
    ])];
    const sheetRows = rows.map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => cell(`${columnName(columnIndex + 1)}${rowIndex + 1}`, value, rowIndex === 0 ? 1 : 0)).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join("");

    const files = [
      { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Escaneos" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123B66"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>` },
      { name: "xl/worksheets/sheet1.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="4" width="20" customWidth="1"/><col min="5" max="5" width="12" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:E${rows.length}"/></worksheet>` }
    ];
    return zip(files);
  };
})();

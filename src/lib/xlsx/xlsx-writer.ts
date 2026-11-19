// DIG-101 — минимальный писатель XLSX (OOXML SpreadsheetML) без внешних
// зависимостей — по образцу собственного PDF-писателя проекта (DIG-27):
// лицензионно чистое решение (только собственный код) и детерминированный
// вывод, который легко проверять юнит-тестами.
//
// Состав пакета: ZIP без сжатия (STORED, CRC32 — подсчитывается здесь)
// из четырёх обязательных частей OOXML: [Content_Types].xml, _rels/.rels,
// xl/workbook.xml (+ его rels) и xl/worksheets/sheetN.xml. Ячейки —
// строки через inlineStr (без sharedStrings), значения экранируются
// (XML-инъекция исключена). Именованных стилей нет: шапка таблицы —
// обычная первая строка листа.

const UTF8 = new TextEncoder();

/** CRC32 (IEEE 802.3, полином 0xEDB88320) — таблица считается один раз. */
const CRC_TABLE: readonly number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC32 содержимого (для ZIP-записей и тестов целостности). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** XML-экранирование текста ячейки/имени листа (& < > " '). */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) =>
    ch === '&'
      ? '&amp;'
      : ch === '<'
        ? '&lt;'
        : ch === '>'
          ? '&gt;'
          : ch === '"'
            ? '&quot;'
            : '&apos;',
  );
}

/** Ссылка колонки: 0 → 'A', 25 → 'Z', 26 → 'AA' (OOXML r="A1"). */
function columnRef(zeroBased: number): string {
  let n = zeroBased + 1;
  let ref = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    ref = String.fromCharCode(65 + rest) + ref;
    n = Math.floor((n - 1) / 26);
  }
  return ref;
}

/** Имя листа: OOXML ограничивает 31 символом и запрещает []:*?/\ . */
function safeSheetName(name: string): string {
  const clean = name.replace(/[[\]:*?/\\]/g, ' ').trim();
  return (clean.length > 0 ? clean : 'Sheet').slice(0, 31);
}

export interface XlsxSheet {
  /** Имя листа (≤ 31 символ, без []:*?/\). */
  name: string;
  /** Строки листа; все значения — текст (inlineStr). */
  rows: readonly (readonly string[])[];
}

function sheetXml(rows: readonly (readonly string[])[]): string {
  const builder: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>',
  ];
  rows.forEach((row, rowIndex) => {
    builder.push(`<row r="${rowIndex + 1}">`);
    row.forEach((value, columnIndex) => {
      builder.push(
        `<c r="${columnRef(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
      );
    });
    builder.push('</row>');
  });
  builder.push('</sheetData></worksheet>');
  return builder.join('');
}

function workbookXml(sheets: readonly XlsxSheet[]): string {
  const items = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(safeSheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${items}</sheets></workbook>`
  );
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ` +
    'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    `${overrides}</Types>`
  );
}

function rootRelsXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'
  );
}

function workbookRelsXml(sheetCount: number): string {
  const items = Array.from({ length: sheetCount }, (_, index) =>
    '<Relationship ' +
    `Id="rId${index + 1}" ` +
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
    `Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `${items}</Relationships>`
  );
}

/**
 * ZIP-контейнер (STORED-записи, фиксированная DOS-дата 1980-01-01 —
 * детерминированный вывод при равных входах).
 */
function buildZip(entries: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  const dosTime = 0;
  const dosDate = ((1980 - 1980) << 9) | (1 << 5) | 1; // 1980-01-01

  let localSize = 0;
  for (const entry of entries) localSize += 30 + entry.name.length + entry.data.length;
  let centralSize = 0;
  for (const entry of entries) centralSize += 46 + entry.name.length;

  const total =
    localSize + centralSize + 22; // EOCD
  const buffer = new Uint8Array(total);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  const offsets: number[] = [];
  for (const entry of entries) {
    offsets.push(offset);
    const nameBytes = UTF8.encode(entry.name);
    const crc = crc32(entry.data);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // версия ZIP
    view.setUint16(offset + 6, 0x0800, true); // флаг UTF-8 имён
    view.setUint16(offset + 8, 0, true); // STORED
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, crc, true);
    view.setUint32(offset + 18, entry.data.length, true); // compressed
    view.setUint32(offset + 22, entry.data.length, true); // uncompressed
    view.setUint16(offset + 26, nameBytes.length, true);
    view.setUint16(offset + 28, 0, true); // extra
    buffer.set(nameBytes, offset + 30);
    buffer.set(entry.data, offset + 30 + nameBytes.length);
    offset += 30 + nameBytes.length + entry.data.length;
  }

  const centralStart = offset;
  entries.forEach((entry, index) => {
    const nameBytes = UTF8.encode(entry.name);
    const crc = crc32(entry.data);
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // made by
    view.setUint16(offset + 6, 20, true); // needed
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, dosTime, true);
    view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, nameBytes.length, true);
    view.setUint16(offset + 30, 0, true); // extra
    view.setUint16(offset + 32, 0, true); // comment
    view.setUint16(offset + 34, 0, true); // disk start
    view.setUint16(offset + 36, 0, true); // internal attrs
    view.setUint32(offset + 38, 0, true); // external attrs
    view.setUint32(offset + 42, offsets[index]!, true); // локальный заголовок
    buffer.set(nameBytes, offset + 46);
    offset += 46 + nameBytes.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);

  return buffer;
}

/** Собрать .xlsx-файл из листов (детерминированный вывод). */
export function buildXlsx(sheets: readonly XlsxSheet[]): Uint8Array {
  const parts: { name: string; data: Uint8Array }[] = [];
  parts.push({ name: '[Content_Types].xml', data: UTF8.encode(contentTypesXml(sheets.length)) });
  parts.push({ name: '_rels/.rels', data: UTF8.encode(rootRelsXml()) });
  parts.push({ name: 'xl/workbook.xml', data: UTF8.encode(workbookXml(sheets)) });
  parts.push({ name: 'xl/_rels/workbook.xml.rels', data: UTF8.encode(workbookRelsXml(sheets.length)) });
  sheets.forEach((sheet, index) => {
    parts.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: UTF8.encode(sheetXml(sheet.rows)),
    });
  });
  return buildZip(parts);
}

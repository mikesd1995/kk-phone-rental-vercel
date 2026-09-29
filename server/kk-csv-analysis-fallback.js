'use strict';

const FALLBACK_VERSION = 'KK_CSV_ANALYSIS_FALLBACK_V2';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter(values => values.some(value => String(value).length > 0));
}

function numericSummary(headers, dataRows) {
  const out = [];
  headers.forEach((header, index) => {
    const values = dataRows
      .map(row => String(row[index] ?? '').trim())
      .filter(Boolean);
    if (!values.length) return;
    const numeric = values.map(Number);
    if (!numeric.every(Number.isFinite)) return;
    const sum = numeric.reduce((a, b) => a + b, 0);
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    out.push({
      column: header || `column_${index + 1}`,
      count: numeric.length,
      min,
      max,
      mean: sum / numeric.length
    });
  });
  return out;
}

function asciiPdfText(value) {
  return String(value || '')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
  const safeLines = (Array.isArray(lines) ? lines : []).slice(0, 42).map(asciiPdfText);
  const streamLines = ['BT', '/F1 10 Tf', '50 750 Td'];
  safeLines.forEach((line, index) => {
    if (index > 0) streamLines.push('0 -14 Td');
    streamLines.push(`(${line.slice(0, 100)}) Tj`);
  });
  streamLines.push('ET');
  const stream = streamLines.join('\n') + '\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`
  ];

  const chunks = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((body, index) => {
    offsets.push(offset);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, 'ascii');
    chunks.push(chunk);
    offset += chunk.length;
  });

  const xrefOffset = offset;
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    ''
  ].join('\n');
  chunks.push(Buffer.from(xref, 'ascii'));
  return Buffer.concat(chunks);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(files) {
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;

  for (const file of files) {
    const name = Buffer.from(String(file.name), 'utf8');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localChunks.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralChunks.push(central, name);

    localOffset += local.length + name.length + data.length;
  }

  const localBytes = Buffer.concat(localChunks);
  const centralBytes = Buffer.concat(centralChunks);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(localBytes.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localBytes, centralBytes, end]);
}

function buildFallbackArtifacts(findingsDocument) {
  const findingsBytes = Buffer.from(JSON.stringify(findingsDocument, null, 2) + '\n', 'utf8');
  const reportBytes = buildSimplePdf([
    'KK CSV Analysis - Degraded Fallback Report',
    '',
    `Question: ${findingsDocument.question}`,
    `Answer: ${findingsDocument.answer}`,
    '',
    `Rows: ${findingsDocument.dataset.rows}`,
    `Columns: ${findingsDocument.dataset.columns}`,
    '',
    'Findings:',
    ...findingsDocument.findings.flatMap((item, index) => [
      `${index + 1}. ${item.title}: ${item.finding}`,
      `Evidence: ${item.evidence}`
    ]),
    '',
    'Caveats:',
    ...findingsDocument.caveats.map(item => `- ${item}`)
  ]);
  const bundleBytes = buildStoredZip([
    { name: 'report.pdf', data: reportBytes },
    { name: 'findings.json', data: findingsBytes }
  ]);
  return {
    report_pdf: reportBytes.toString('base64'),
    findings_json: findingsBytes.toString('base64'),
    charts: {},
    bundle_zip: bundleBytes.toString('base64')
  };
}

async function runFallbackAnalysis(request) {
  const text = request.csv_bytes.toString('utf8');
  const rows = parseCsv(text);
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);
  const numeric = numericSummary(headers, dataRows);
  const findings = [{
    title: 'Dataset profile',
    finding: `Fallback analysis read ${dataRows.length} data rows across ${headers.length} columns.`,
    evidence: `Rows=${dataRows.length}; columns=${headers.length}`,
    importance: 'medium'
  }];

  if (numeric.length) {
    const strongest = [...numeric].sort((a, b) => Math.abs(b.max - b.min) - Math.abs(a.max - a.min))[0];
    findings.push({
      title: `Numeric range: ${strongest.column}`,
      finding: `${strongest.column} ranges from ${strongest.min} to ${strongest.max} with mean ${Number(strongest.mean.toFixed(4))}.`,
      evidence: `n=${strongest.count}; min=${strongest.min}; max=${strongest.max}; mean=${Number(strongest.mean.toFixed(4))}`,
      importance: 'low'
    });
  }

  const answer = `Fallback descriptive profile completed for ${dataRows.length} rows and ${headers.length} columns. Remote agent analysis was unavailable, so this result is intentionally limited to deterministic descriptive evidence.`;
  const caveats = [
    'Degraded fallback mode: no OpenAI-hosted agent reasoning or Python sandbox executed.',
    'Fallback analysis is descriptive and should not be treated as a substitute for the full question-directed agent investigation.'
  ];
  const findingsDocument = {
    question: request.question,
    answer,
    dataset: { rows: dataRows.length, columns: headers.length },
    findings,
    caveats,
    charts: []
  };

  return {
    schema_version: 'KK_CSV_ANALYSIS_ENGINE_RESULT_V1',
    fallback_version: FALLBACK_VERSION,
    engine_mode: 'fallback',
    ...findingsDocument,
    artifacts: {
      report_pdf: 'report.pdf',
      findings_json: 'findings.json',
      charts: [],
      bundle_zip: 'results.zip'
    },
    artifact_transport: 'inline_base64',
    artifact_payloads_base64: buildFallbackArtifacts(findingsDocument),
    production_writes: 0,
    publishes: 0
  };
}

module.exports = {
  FALLBACK_VERSION,
  parseCsv,
  numericSummary,
  buildSimplePdf,
  crc32,
  buildStoredZip,
  buildFallbackArtifacts,
  runFallbackAnalysis
};

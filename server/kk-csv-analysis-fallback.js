'use strict';

const FALLBACK_VERSION = 'KK_CSV_ANALYSIS_FALLBACK_V1';

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

  return {
    schema_version: 'KK_CSV_ANALYSIS_ENGINE_RESULT_V1',
    fallback_version: FALLBACK_VERSION,
    engine_mode: 'fallback',
    question: request.question,
    answer: `Fallback descriptive profile completed for ${dataRows.length} rows and ${headers.length} columns. Remote agent analysis was unavailable, so this result is intentionally limited to deterministic descriptive evidence.`,
    dataset: { rows: dataRows.length, columns: headers.length },
    findings,
    caveats: [
      'Degraded fallback mode: no OpenAI-hosted agent reasoning or Python sandbox executed.',
      'Fallback analysis is descriptive and should not be treated as a substitute for the full question-directed agent investigation.'
    ],
    charts: [],
    artifacts: {
      report_pdf: 'report.pdf',
      findings_json: 'findings.json',
      charts: [],
      bundle_zip: 'results.zip'
    },
    production_writes: 0,
    publishes: 0
  };
}

module.exports = {
  FALLBACK_VERSION,
  parseCsv,
  numericSummary,
  runFallbackAnalysis
};

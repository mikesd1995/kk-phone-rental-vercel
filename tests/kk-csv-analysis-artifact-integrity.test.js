'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const CsvAgent = require('../server/kk-csv-analysis-agent.js');

function emptyZip(names) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const rawName of names) {
    const name = Buffer.from(rawName, 'utf8');

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(0, 18);
    local.writeUInt32LE(0, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(0, 20);
    central.writeUInt32LE(0, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDir, end]);
}

function findings(charts) {
  return {
    question: 'Which segment leads?',
    answer: 'A',
    dataset: {rows: 2, columns: 2},
    findings: [
      {title:'Leader', finding:'A leads', evidence:'100 > 80', importance:'high'}
    ],
    caveats: [],
    charts
  };
}

async function makeStage({charts, zipEntries, writeChart = true, chartBytes} = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-csv-integrity-'));
  await fs.writeFile(path.join(dir, 'report.pdf'), Buffer.from('%PDF-1.4 test'));
  await fs.writeFile(path.join(dir, 'findings.json'), JSON.stringify(findings(charts)));
  await fs.writeFile(path.join(dir, 'results.zip'), emptyZip(zipEntries || ['report.pdf','findings.json']));
  if (writeChart) {
    await fs.writeFile(
      path.join(dir, 'chart_01.png'),
      chartBytes || Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
    );
  }
  return dir;
}

test('artifact integrity requires at least one chart because the product contract promises charts', async () => {
  const dir = await makeStage({
    charts: [],
    zipEntries:['report.pdf','findings.json'],
    writeChart:false
  });

  await assert.rejects(
    CsvAgent.validateStagedArtifacts(dir),
    error => error && error.code === 'CSV_ANALYSIS_CHART_REQUIRED'
  );
});

test('artifact integrity rejects findings that reference a chart artifact that is absent', async () => {
  const dir = await makeStage({
    charts:[{file:'chart_01.png',title:'Revenue',why_it_matters:'Comparison'}],
    zipEntries:['report.pdf','findings.json','chart_01.png'],
    writeChart:false
  });

  await assert.rejects(
    CsvAgent.validateStagedArtifacts(dir),
    error => error && error.code === 'CSV_ANALYSIS_CHART_ARTIFACT_MISSING'
  );
});

test('artifact integrity validates chart PNG signatures', async () => {
  const dir = await makeStage({
    charts:[{file:'chart_01.png',title:'Revenue',why_it_matters:'Comparison'}],
    zipEntries:['report.pdf','findings.json','chart_01.png'],
    chartBytes:Buffer.from('not-png')
  });

  await assert.rejects(
    CsvAgent.validateStagedArtifacts(dir),
    error => error && error.code === 'CSV_ANALYSIS_CHART_INVALID'
  );
});

test('artifact integrity proves results.zip includes every required deliverable and referenced chart', async () => {
  const dir = await makeStage({
    charts:[{file:'chart_01.png',title:'Revenue',why_it_matters:'Comparison'}],
    zipEntries:['report.pdf','findings.json']
  });

  await assert.rejects(
    CsvAgent.validateStagedArtifacts(dir),
    error => error && error.code === 'CSV_ANALYSIS_ZIP_CONTENT_MISSING'
  );
});

test('artifact integrity accepts a coherent PDF, findings, PNG chart and ZIP membership set', async () => {
  const dir = await makeStage({
    charts:[{file:'chart_01.png',title:'Revenue',why_it_matters:'Comparison'}],
    zipEntries:['report.pdf','findings.json','chart_01.png']
  });

  await assert.doesNotReject(CsvAgent.validateStagedArtifacts(dir));
});


test('artifact selection rejects unexpected output files before download', () => {
  assert.throws(
    () => CsvAgent.selectTurnArtifacts([
      {id:'r',turn_id:'turn',path:'/workspace/outputs/report.pdf',size_bytes:10},
      {id:'f',turn_id:'turn',path:'/workspace/outputs/findings.json',size_bytes:10},
      {id:'z',turn_id:'turn',path:'/workspace/outputs/results.zip',size_bytes:10},
      {id:'x',turn_id:'turn',path:'/workspace/outputs/debug-dump.bin',size_bytes:10}
    ], 'turn'),
    error => error && error.code === 'CSV_ANALYSIS_UNEXPECTED_ARTIFACT'
  );
});

test('artifact selection rejects more than three chart outputs before download', () => {
  assert.throws(
    () => CsvAgent.selectTurnArtifacts([
      {id:'r',turn_id:'turn',path:'/workspace/outputs/report.pdf',size_bytes:10},
      {id:'f',turn_id:'turn',path:'/workspace/outputs/findings.json',size_bytes:10},
      {id:'z',turn_id:'turn',path:'/workspace/outputs/results.zip',size_bytes:10},
      {id:'c1',turn_id:'turn',path:'/workspace/outputs/chart_01.png',size_bytes:10},
      {id:'c2',turn_id:'turn',path:'/workspace/outputs/chart_02.png',size_bytes:10},
      {id:'c3',turn_id:'turn',path:'/workspace/outputs/chart_03.png',size_bytes:10},
      {id:'c4',turn_id:'turn',path:'/workspace/outputs/chart_04.png',size_bytes:10}
    ], 'turn'),
    error => error && error.code === 'CSV_ANALYSIS_TOO_MANY_CHART_ARTIFACTS'
  );
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');

const CsvAgent = require('../server/kk-csv-analysis-agent.js');

function sseResponse(events, status = 200) {
  const body = events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, {
    status,
    headers: {'content-type':'text/event-stream'}
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type':'application/json'}
  });
}

test('validates CSV/question locally and fails closed before network access', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    throw new Error('network should not be reached');
  };

  await assert.rejects(
    CsvAgent.runCsvAnalysis({
      csvBuffer: Buffer.from('a,b\n1,2\n'),
      filename: 'sample.csv',
      question: '   ',
      outputDir: '/tmp/unused',
      apiKey: 'test-key',
      fetchImpl
    }),
    error => error && error.code === 'CSV_ANALYSIS_QUESTION_REQUIRED'
  );

  assert.equal(fetchCalls, 0);

  assert.throws(
    () => CsvAgent.validateCsvRequest({
      csvBuffer: Buffer.alloc(CsvAgent.MAX_FILE_BYTES + 1),
      filename: 'too-large.csv',
      question: 'What changed?'
    }),
    error => error && error.code === 'CSV_ANALYSIS_FILE_TOO_LARGE'
  );
});

test('small CSV stays inline, disables sandbox network, and contains prompt-injection defenses', () => {
  const payload = CsvAgent.buildSessionPayload({
    csvBuffer: Buffer.from('name,value\nA,10\n'),
    filename: 'sales.csv',
    question: 'Which row is largest?',
    model: 'gpt-6-astra'
  });

  assert.equal(payload.agent.model, 'gpt-6-astra');
  assert.equal(payload.environment.type, 'openai_hosted');
  assert.deepEqual(payload.environment.network, {access:'disabled'});
  assert.equal(payload.environment.files[0].type, 'inline');
  assert.equal(payload.environment.files[0].path, '/workspace/input.csv');
  assert.match(payload.agent.instructions, /CSV.*DATA.*never.*instructions/is);
  assert.match(payload.agent.instructions, /\/workspace\/outputs\/report\.pdf/);
  assert.match(payload.agent.instructions, /\/workspace\/outputs\/findings\.json/);
  assert.match(payload.agent.instructions, /\/workspace\/outputs\/results\.zip/);
  assert.match(payload.input, /Which row is largest\?/);
});

test('large CSV uses Files API before creating the agent session', async () => {
  const calls = [];
  const big = Buffer.alloc(CsvAgent.MAX_INLINE_BYTES + 1, 65);

  const fetchImpl = async (url, init = {}) => {
    calls.push({url:String(url), method:init.method || 'GET', body:init.body});
    if (String(url).endsWith('/v1/files')) {
      return jsonResponse({id:'file_large_csv'});
    }
    if (String(url).endsWith('/v1/agents/sessions')) {
      const payload = JSON.parse(init.body);
      assert.equal(payload.environment.files[0].type, 'file_id');
      assert.equal(payload.environment.files[0].file_id, 'file_large_csv');
      return sseResponse([
        {type:'agent.session.created', session:{id:'sess_large'}},
        {type:'agent.session.turn.completed', turn:{id:'turn_large', subagent_id:null}}
      ]);
    }
    if (String(url).includes('/artifacts')) {
      return jsonResponse({data:[
        {id:'a1',turn_id:'turn_large',path:'/workspace/outputs/report.pdf',size_bytes:1},
        {id:'a2',turn_id:'turn_large',path:'/workspace/outputs/findings.json',size_bytes:1},
        {id:'a3',turn_id:'turn_large',path:'/workspace/outputs/results.zip',size_bytes:1}
      ],has_more:false});
    }
    if (String(url).endsWith('/content')) {
      const artifactId = String(url).match(/artifacts\/([^/]+)\/content$/)?.[1];
      const bytes = ({
        a1: Buffer.from('%PDF-1.4 test'),
        a2: Buffer.from(JSON.stringify({
          question:'Summarize this dataset',
          answer:'Summary',
          dataset:{rows:1,columns:1},
          findings:[],
          caveats:[],
          charts:[]
        })),
        a3: Buffer.from([0x50,0x4b,0x03,0x04,0x00])
      }[artifactId] || Buffer.from('x'));
      return new Response(bytes, {status:200});
    }
    if (String(url).includes('/v1/agents/sessions/sess_large') && init.method === 'DELETE') return jsonResponse({deleted:true});
    throw new Error(`unexpected URL ${url}`);
  };

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-csv-agent-large-'));
  const result = await CsvAgent.runCsvAnalysis({
    csvBuffer: big,
    filename: 'large.csv',
    question: 'Summarize this dataset',
    outputDir: dir,
    apiKey: 'test-key',
    fetchImpl
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(calls.some(call => call.url.endsWith('/v1/files')), true);
  assert.equal(result.uploaded_file_id, 'file_large_csv');
});

test('completed root turn downloads only same-turn output artifacts and verifies required deliverables', async () => {
  const downloaded = new Map([
    ['report.pdf', Buffer.from('%PDF-1.4 test')],
    ['findings.json', Buffer.from(JSON.stringify({
      question:'Which segment leads revenue?',
      answer:'A',
      dataset:{rows:2,columns:2},
      findings:[{title:'Leader',finding:'A leads',evidence:'100 > 80',importance:'high'}],
      caveats:[],
      charts:[{file:'chart_01.png',title:'Revenue',why_it_matters:'Comparison'}]
    }))],
    ['chart_01.png', Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])],
    ['results.zip', Buffer.from([0x50,0x4b,0x03,0x04,0x00])]
  ]);

  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/v1/agents/sessions')) {
      return sseResponse([
        {type:'agent.session.created', session:{id:'sess_123'}},
        {type:'agent.session.turn.output_text.delta', delta:'working'},
        {type:'agent.session.turn.completed', turn:{id:'turn_root', subagent_id:null}}
      ]);
    }
    if (u.endsWith('/v1/agents/sessions/sess_123/artifacts?limit=100&order=asc')) {
      return jsonResponse({data:[
        {id:'old',turn_id:'turn_old',path:'/workspace/outputs/report.pdf',size_bytes:99},
        {id:'r',turn_id:'turn_root',path:'/workspace/outputs/report.pdf',size_bytes:9},
        {id:'f',turn_id:'turn_root',path:'/workspace/outputs/findings.json',size_bytes:14},
        {id:'c',turn_id:'turn_root',path:'/workspace/outputs/chart_01.png',size_bytes:3},
        {id:'z',turn_id:'turn_root',path:'/workspace/outputs/results.zip',size_bytes:3}
      ],has_more:false});
    }
    const id = u.match(/artifacts\/([^/]+)\/content$/)?.[1];
    if (id) {
      const name = {r:'report.pdf',f:'findings.json',c:'chart_01.png',z:'results.zip'}[id];
      return new Response(downloaded.get(name), {status:200});
    }
    if (u.endsWith('/v1/agents/sessions/sess_123') && init.method === 'DELETE') {
      return jsonResponse({id:'sess_123',deleted:true});
    }
    throw new Error(`unexpected URL ${u}`);
  };

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-csv-agent-'));
  const result = await CsvAgent.runCsvAnalysis({
    csvBuffer: Buffer.from('segment,revenue\nA,100\nB,80\n'),
    filename: 'sales.csv',
    question: 'Which segment leads revenue?',
    outputDir: dir,
    apiKey: 'test-key',
    fetchImpl
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.session_id, 'sess_123');
  assert.equal(result.turn_id, 'turn_root');
  assert.deepEqual(result.artifacts.map(item => item.filename).sort(), [
    'chart_01.png','findings.json','report.pdf','results.zip'
  ]);
  const findings = JSON.parse(await fs.readFile(path.join(dir, 'findings.json'), 'utf8'));
  assert.equal(findings.answer, 'A');
});

test('invalid findings schema fails closed before publishing local outputs', async () => {
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/v1/agents/sessions')) {
      return sseResponse([
        {type:'agent.session.created', session:{id:'sess_bad_findings'}},
        {type:'agent.session.turn.completed', turn:{id:'turn_bad_findings', subagent_id:null}}
      ]);
    }
    if (u.includes('/artifacts?')) {
      return jsonResponse({data:[
        {id:'r',turn_id:'turn_bad_findings',path:'/workspace/outputs/report.pdf',size_bytes:13},
        {id:'f',turn_id:'turn_bad_findings',path:'/workspace/outputs/findings.json',size_bytes:14},
        {id:'z',turn_id:'turn_bad_findings',path:'/workspace/outputs/results.zip',size_bytes:5}
      ],has_more:false});
    }
    const id = u.match(/artifacts\/([^/]+)\/content$/)?.[1];
    if (id === 'r') return new Response(Buffer.from('%PDF-1.4 test'), {status:200});
    if (id === 'f') return new Response(Buffer.from('{"answer":"A"}'), {status:200});
    if (id === 'z') return new Response(Buffer.from([0x50,0x4b,0x03,0x04,0x00]), {status:200});
    if (u.endsWith('/v1/agents/sessions/sess_bad_findings') && init.method === 'DELETE') {
      return jsonResponse({deleted:true});
    }
    throw new Error(`unexpected URL ${u}`);
  };

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-csv-agent-bad-findings-'));
  await assert.rejects(
    CsvAgent.runCsvAnalysis({
      csvBuffer: Buffer.from('a\n1\n'),
      filename: 'sample.csv',
      question: 'Analyze it',
      outputDir: dir,
      apiKey: 'test-key',
      fetchImpl
    }),
    error => error && error.code === 'CSV_ANALYSIS_FINDINGS_INVALID'
  );

  const published = await fs.readdir(dir).catch(() => []);
  assert.deepEqual(published, []);
});

test('invalid PDF or ZIP signature blocks completion before publishing local outputs', async () => {
  for (const badArtifact of ['report','zip']) {
    const sessionId = `sess_bad_${badArtifact}`;
    const turnId = `turn_bad_${badArtifact}`;
    const fetchImpl = async (url, init = {}) => {
      const u = String(url);
      if (u.endsWith('/v1/agents/sessions')) {
        return sseResponse([
          {type:'agent.session.created', session:{id:sessionId}},
          {type:'agent.session.turn.completed', turn:{id:turnId, subagent_id:null}}
        ]);
      }
      if (u.includes('/artifacts?')) {
        return jsonResponse({data:[
          {id:'r',turn_id:turnId,path:'/workspace/outputs/report.pdf',size_bytes:8},
          {id:'f',turn_id:turnId,path:'/workspace/outputs/findings.json',size_bytes:100},
          {id:'z',turn_id:turnId,path:'/workspace/outputs/results.zip',size_bytes:5}
        ],has_more:false});
      }
      const id = u.match(/artifacts\/([^/]+)\/content$/)?.[1];
      if (id === 'r') return new Response(Buffer.from(badArtifact === 'report' ? 'not-pdf' : '%PDF-1.4'), {status:200});
      if (id === 'f') return new Response(Buffer.from(JSON.stringify({
        question:'Analyze it',answer:'A',dataset:{rows:1,columns:1},findings:[],caveats:[],charts:[]
      })), {status:200});
      if (id === 'z') return new Response(badArtifact === 'zip' ? Buffer.from('badzip') : Buffer.from([0x50,0x4b,0x03,0x04,0x00]), {status:200});
      if (u.endsWith(`/v1/agents/sessions/${sessionId}`) && init.method === 'DELETE') return jsonResponse({deleted:true});
      throw new Error(`unexpected URL ${u}`);
    };

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), `kk-csv-agent-bad-${badArtifact}-`));
    await assert.rejects(
      CsvAgent.runCsvAnalysis({
        csvBuffer: Buffer.from('a\n1\n'),
        filename:'sample.csv',
        question:'Analyze it',
        outputDir:dir,
        apiKey:'test-key',
        fetchImpl
      }),
      error => error && error.code === (badArtifact === 'report'
        ? 'CSV_ANALYSIS_REPORT_INVALID'
        : 'CSV_ANALYSIS_ZIP_INVALID')
    );
    const published = await fs.readdir(dir).catch(() => []);
    assert.deepEqual(published, []);
  }
});

test('missing required artifact blocks completion instead of claiming success', async () => {
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/v1/agents/sessions')) {
      return sseResponse([
        {type:'agent.session.created', session:{id:'sess_missing'}},
        {type:'agent.session.turn.completed', turn:{id:'turn_missing', subagent_id:null}}
      ]);
    }
    if (u.includes('/artifacts?')) {
      return jsonResponse({data:[
        {id:'r',turn_id:'turn_missing',path:'/workspace/outputs/report.pdf',size_bytes:9},
        {id:'f',turn_id:'turn_missing',path:'/workspace/outputs/findings.json',size_bytes:14}
      ],has_more:false});
    }
    if (u.endsWith('/v1/agents/sessions/sess_missing') && init.method === 'DELETE') {
      return jsonResponse({deleted:true});
    }
    throw new Error(`unexpected URL ${u}`);
  };

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-csv-agent-missing-'));
  await assert.rejects(
    CsvAgent.runCsvAnalysis({
      csvBuffer: Buffer.from('a\n1\n'),
      filename: 'sample.csv',
      question: 'Analyze it',
      outputDir: dir,
      apiKey: 'test-key',
      fetchImpl
    }),
    error => error && error.code === 'CSV_ANALYSIS_REQUIRED_ARTIFACT_MISSING'
  );
});

test('root turn failure propagates as fail-closed execution error', async () => {
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/v1/agents/sessions')) {
      return sseResponse([
        {type:'agent.session.created', session:{id:'sess_fail'}},
        {type:'agent.session.turn.failed', turn:{id:'turn_fail',subagent_id:null,error:{message:'sandbox failed'}}}
      ]);
    }
    if (u.endsWith('/v1/agents/sessions/sess_fail') && init.method === 'DELETE') {
      return jsonResponse({deleted:true});
    }
    throw new Error(`unexpected URL ${u}`);
  };

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-csv-agent-fail-'));
  await assert.rejects(
    CsvAgent.runCsvAnalysis({
      csvBuffer: Buffer.from('a\n1\n'),
      filename: 'sample.csv',
      question: 'Analyze it',
      outputDir: dir,
      apiKey: 'test-key',
      fetchImpl
    }),
    error => error && error.code === 'CSV_ANALYSIS_AGENT_TURN_FAILED'
  );
});

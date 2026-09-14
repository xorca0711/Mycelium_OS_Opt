import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv, mapFile, inspectFile } from '../src/lib/imports/files.ts';
import { classifyItem, contentHash, textDocument } from '../src/lib/imports/model.ts';
import { notionId, NotionClient, fetchNotion } from '../src/lib/imports/notionClient.ts';

test('CSV handles BOM, quoted delimiters/newlines/quotes and rejects malformed/duplicate identities', () => {
  const text = '\uFEFFid,title,body\r\n1,"A, B","first\nsecond ""quoted"""\r\n';
  assert.deepEqual(parseCsv(text), [['id','title','body'], ['1','A, B','first\nsecond "quoted"']]);
  assert.deepEqual(inspectFile(text, 'csv'), ['id','title','body']);
  assert.equal(mapFile(text, 'csv', { id:'id', title:'title', content:'body' })[0].title, 'A, B');
  assert.throws(() => parseCsv('id,title\n1,"open'), /unterminated/);
  assert.throws(() => parseCsv('id,title\n1,"closed"extra'), /quoting/);
  assert.throws(() => mapFile('id,title,body\n1,A,X\n1,B,Y', 'csv', {id:'id',title:'title',content:'body'}), /Duplicate/);
});
test('JSON mapping requires explicit typed fields and preserves source markup as inert text', () => {
  assert.deepEqual(inspectFile('{"notes":[{"id":1,"title":"a","body":"b"}]}', 'json'), ['id','title','body']);
  assert.throws(() => mapFile('[{"id":1,"title":"a","body":{}}]', 'json', {id:'id',title:'title',content:'body'}), /must be text/);
  assert.throws(() => inspectFile('null', 'json'), /array/);
  const json = JSON.parse(textDocument('<script>alert(1)</script>\n![image](https://example.invalid/tracker)'));
  assert.equal(json.content[0].content[0].type, 'text');
  assert.equal(json.content[0].content[0].text, '<script>alert(1)</script>');
});
test('Import classification preserves local edits, archive and deletion while matching repeat imports', async () => {
  const payload = { externalId:'one', title:'Title', content:'Body', updatedAt:null };
  const created = await classifyItem(payload);
  const prior = { external_id:'one', note_id:'note', content_hash:created.hash, source_updated_at:null, title:payload.title, content_plain:payload.content, content_json:created.contentJson, status:'active' };
  assert.equal(created.action, 'create');
  assert.equal((await classifyItem(payload, prior)).action, 'unchanged');
  assert.equal((await classifyItem({...payload, content:'new source'}, prior)).action, 'update');
  assert.equal((await classifyItem({...payload, content:'new source'}, {...prior, content_json:textDocument('local edit')})).action, 'conflict');
  assert.equal((await classifyItem(payload, {...prior, note_id:null})).action, 'deleted');
  assert.equal((await classifyItem(payload, {...prior, status:'archived'})).action, 'conflict');
  assert.notEqual(await contentHash('a','b','c'), await contentHash('a','bc',''));
});
test('Notion IDs use path IDs, never view IDs or foreign hosts', () => {
  const id = '12345678-abcd-1234-abcd-123456789abc';
  assert.equal(notionId(`https://www.notion.so/Page-${id.replaceAll('-','')}?v=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`), id);
  assert.equal(notionId(id), id);
  assert.throws(() => notionId(`https://notion.so.attacker.invalid/${id}`), /Notion HTTPS/);
  assert.throws(() => notionId('https://www.notion.so/page?v=12345678abcd1234abcd123456789abc'), /required/);
});
test('Notion throttling honors Retry-After and uses the current API with sequential requests', async () => {
  const waits: number[] = [], calls: RequestInit[] = [];
  const client = new NotionClient('secret-test', async (_url, init) => {
    calls.push(init);
    return calls.length === 1 ? new Response('', {status:429,headers:{'Retry-After':'65'}}) : Response.json({ok:true});
  }, {signal:new AbortController().signal,onProgress:()=>{}}, async ms => { waits.push(ms); }, () => 1000);
  assert.deepEqual(await client.request('/pages/test'), {ok:true});
  assert.ok(waits.includes(65000));
  assert.equal((calls[0].headers as Record<string,string>)['Notion-Version'], '2026-03-11');
  assert.equal(calls.length, 2);
});
test('Notion credential failures are not retried and response bodies are not surfaced', async () => {
  let calls = 0;
  const client = new NotionClient('secret-test', async () => { calls++; return new Response('sensitive response', {status:401}); }, {signal:new AbortController().signal,onProgress:()=>{}}, async()=>{});
  await assert.rejects(client.request('/pages/test'), error => String(error).includes('rejected the token') && !String(error).includes('sensitive'));
  assert.equal(calls, 1);
  const abort = new AbortController(); abort.abort();
  const cancelled = new NotionClient('secret-test', async()=>{ throw new Error('Should not fetch'); }, {signal:abort.signal,onProgress:()=>{}}, async()=>{});
  await assert.rejects(cancelled.request('/pages/test'), {name:'AbortError'});
});
test('Notion skips markdown requests for unchanged copies and refuses partial pages', async () => {
  const id = '12345678-abcd-1234-abcd-123456789abc';
  const title = 'Title', content = 'Saved';
  const json = textDocument(content), hash = await contentHash(title,content,json);
  const record = {external_id:id,note_id:'note',content_hash:hash,source_updated_at:'2026-09-14',title,content_plain:content,content_json:json,status:'active'};
  const urls: string[] = [];
  const page = {id,last_edited_time:'2026-09-14',url:'',properties:{Name:{type:'title',title:[{plain_text:title}]}}};
  const options = {token:'secret-test',source:id,type:'page' as const,limit:1};
  const progress = {signal:new AbortController().signal,onProgress:()=>{}};
  const result = await fetchNotion(options, progress, async url => { urls.push(url); return Response.json(page); }, new Map([[id,record]]));
  assert.equal(urls.length,1); assert.equal(result.payloads[0].content, content);
  const partial = await fetchNotion(options, progress, async url => Response.json(url.endsWith('/markdown') ? {markdown:'partial',truncated:true,unknown_block_ids:[]} : page), new Map());
  assert.equal(partial.payloads.length,0); assert.match(partial.warnings[0], /incomplete/);
});

test('Notion imports concatenate rich-text runs while keeping list property separators', async () => {
  const id = '12345678-abcd-1234-abcd-123456789abc';
  const page = {
    id, last_edited_time: '2026-09-14', url: '',
    properties: {
      Name: { type: 'title', title: [
        { type: 'text', plain_text: 'Quarterly ', text: { content: 'Quarterly ' } },
        { type: 'text', plain_text: 'report', text: { content: 'report' }, annotations: { bold: true } },
      ] },
      Summary: { type: 'rich_text', rich_text: [
        { type: 'text', plain_text: 'Read ', text: { content: 'Read ' } },
        { type: 'text', plain_text: 'this', text: { content: 'this' }, annotations: { italic: true } },
        { type: 'text', plain_text: ' first.\n한글 😀', text: { content: ' first.\n한글 😀' } },
      ] },
      Tags: { type: 'multi_select', multi_select: [{ name: 'Work' }, { name: 'Research' }] },
      People: { type: 'people', people: [{ id: 'person-1', name: 'Ada' }, { id: 'person-2', name: 'Grace' }] },
      Related: { type: 'relation', relation: [{ id: 'related-1' }, { id: 'related-2' }] },
    },
  };
  const result = await fetchNotion(
    { token: 'synthetic-token', source: id, type: 'page', limit: 1 },
    { signal: new AbortController().signal, onProgress: () => {} },
    async url => Response.json(url.endsWith('/markdown') ? { markdown: 'Body', truncated: false, unknown_block_ids: [] } : page),
    new Map(),
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.payloads.length, 1);
  assert.equal(result.payloads[0].title, 'Quarterly report');
  assert.equal(result.payloads[0].content, [
    'Body', '', '---', `Notion source: https://www.notion.so/${id.replaceAll('-', '')}`, '',
    'Properties (source snapshot):', 'Name: Quarterly report', 'Summary: Read this first.\n한글 😀',
    'Tags: Work, Research', 'People: Ada, Grace', 'Related: {"id":"related-1"}, {"id":"related-2"}',
  ].join('\n'));
});

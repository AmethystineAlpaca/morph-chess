import test from 'node:test';
import assert from 'node:assert/strict';
import { StockfishEngine } from './engine.js';
function fixture() {
  const commands = [];
  const worker = { postMessage: command => commands.push(command), terminate() { this.stopped = true; } };
  const engine = new StockfishEngine({workerFactory: url => { assert.equal(url,'/morph-chess/engine/stockfish-19-lite-single.js'); return worker; }, base:'/morph-chess/'});
  const reply = line => worker.onmessage({data:line});
  return { engine, worker, reply, commands };
}
test('waits for UCI handshake, sends full history, and parses underpromotion', async () => {
  const {engine,reply,commands} = fixture();
  const ready = engine.init('club'); reply('uciok'); await Promise.resolve(); reply('readyok'); await ready;
  assert.ok(commands.includes('setoption name Skill Level value 8'));
  const move = engine.bestMove(['e2e4','e7e5'],'club');
  reply('info depth 1'); reply('bestmove a7a8n ponder e8e7');
  assert.deepEqual(await move,{from:'a7',to:'a8',promotion:'n'});
  assert.ok(commands.includes('position startpos moves e2e4 e7e5')); engine.dispose();
});
test('restart disposes the worker and rejects pending search', async () => {
  const {engine,worker} = fixture();
  const pending = engine.bestMove([], 'casual');
  engine.dispose(); await assert.rejects(pending,/stopped/); assert.equal(worker.stopped,true);
});
test('worker load errors fail pending initialization', async () => {
  const {engine,worker} = fixture(); const pending = engine.init();
  worker.onerror(); await assert.rejects(pending,/could not load/); engine.dispose();
});

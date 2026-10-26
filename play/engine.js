export class StockfishEngine {
  constructor({ workerFactory = url => new Worker(url), base = import.meta.env?.BASE_URL || '/' } = {}) {
    this.worker = workerFactory(`${base}engine/stockfish-19-lite-single.js`);
    this.pending = null;
    this.worker.onmessage = event => {
      for (const line of String(event.data).split('\n')) {
        if (this.pending?.match(line)) {
          const pending = this.pending; this.pending = null;
          clearTimeout(pending.timer); pending.resolve(line);
        }
      }
    };
    this.worker.onerror = () => this.fail(new Error('Stockfish could not load. Check your connection and retry.'));
    this.worker.onmessageerror = () => this.fail(new Error('Stockfish communication failed. Please retry.'));
  }
  fail(error) {
    this.error = error;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
  }
  wait(match, commands, timeout = 30000) {
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Stockfish took too long to respond. Please retry.')), timeout);
      this.pending = { match, resolve, reject, timer };
      for (const command of commands) this.worker.postMessage(command);
    });
  }
  async init(level = 'casual') {
    await this.wait(line => line === 'uciok', ['uci']);
    const skill = { casual: 0, club: 8, strong: 18 }[level] ?? 0;
    await this.wait(line => line === 'readyok', ['setoption name Hash value 16', `setoption name Skill Level value ${skill}`, 'ucinewgame', 'isready']);
  }
  async bestMove(history, level) {
    const time = { casual: 250, club: 600, strong: 1200 }[level] || 250;
    const line = await this.wait(line => line.startsWith('bestmove '), [`position startpos moves ${history.join(' ')}`, `go movetime ${time}`], 15000);
    const move = line.split(' ')[1];
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) throw new Error('Stockfish returned no playable move. Please retry.');
    return { from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) };
  }
  dispose() { this.fail(new Error('Engine stopped')); this.worker.terminate(); }
}

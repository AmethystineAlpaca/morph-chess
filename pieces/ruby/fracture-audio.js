// A single transport clock drives both the animation and the supplied recording.
// Stopping, scrubbing or replaying always cancels the previous sound source.
export class FractureAudio {
  constructor(clips, fractureTime, { Context = globalThis.AudioContext || globalThis.webkitAudioContext, fetchAudio = globalThis.fetch, random = Math.random } = {}) {
    this.fractureTime = fractureTime;
    this.muted = false;
    this.source = null;
    this.anchor = 0;
    this.position = 0;
    this.rate = 1;
    this.running = false;
    this.random = random;
    this.variants = [];
    this.selected = null;
    this.context = Context ? new Context() : null;
    if (this.context) {
      this.gain = this.context.createGain();
      this.gain.gain.value = .7;
      this.gain.connect(this.context.destination);
    }
    const sources = Array.isArray(clips) ? clips : [{ url: clips, gain: .7 }];
    this.ready = this.context ? Promise.allSettled(sources.map(async ({ url, gain = .7 }) => {
      const response = await fetchAudio(url);
      if (!response.ok) throw new Error('Glass sound could not be loaded.');
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      return { buffer, gain };
    })).then(results => {
      this.variants = results.filter(result => result.status === 'fulfilled').map(result => result.value);
      if (!this.variants.length) throw new Error('No glass sounds could be loaded.');
    }) : Promise.reject(new Error('Web Audio is unavailable.'));
  }

  get clock() { return this.context?.currentTime ?? performance.now() / 1000; }
  get time() { return this.position + (this.running ? Math.max(0, this.clock - this.anchor) * this.rate : 0); }

  async unlock() {
    // Called directly from the play button's user gesture, before any await.
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  start(position, rate, { newTake = false } = {}) {
    this.stop();
    // Only a new break chooses a recording. Resuming, scrubbing and changing
    // speed must retain the same recording and its exact current offset.
    if ((newTake || !this.selected) && this.variants.length) {
      this.selected = this.variants[Math.floor(this.random() * this.variants.length)];
    }
    this.setMuted(this.muted);
    this.position = position; this.rate = rate; this.anchor = this.clock; this.running = true;
    const offset = Math.max(0, position - this.fractureTime);
    if (!this.selected || offset >= this.selected.buffer.duration) return;
    const source = this.context.createBufferSource();
    source.buffer = this.selected.buffer;
    source.playbackRate.value = rate;
    source.connect(this.gain);
    source.start(this.anchor + Math.max(0, this.fractureTime - position) / rate, offset);
    source.onended = () => { source.disconnect(); if (this.source === source) this.source = null; };
    this.source = source;
  }

  stop() {
    this.position = this.time; this.running = false;
    if (this.source) { this.source.stop(); this.source.disconnect(); this.source = null; }
  }

  setMuted(muted) {
    this.muted = muted;
    this.gain?.gain.setTargetAtTime(muted ? 0 : (this.selected?.gain ?? .7), this.clock, .015);
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { FractureAudio } from './fracture-audio.js';

class AudioContextStub {
  currentTime = 10;
  state = 'suspended';
  sources = [];
  createGain() { return { gain: { value: 0, setTargetAtTime(value) { this.value = value; } }, connect() {} }; }
  async decodeAudioData() { return { duration: 1.92 }; }
  async resume() { this.state = 'running'; }
  createBufferSource() {
    const source = {
      playbackRate: { value: 1 }, connect() {}, disconnect() {},
      start(at, offset) { this.at = at; this.offset = offset; },
      stop() { this.stopped = true; },
    };
    this.sources.push(source); return source;
  }
}
const createAudio = () => new FractureAudio('glass.wav', .65, {
  Context: AudioContextStub,
  fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
});

test('the recording begins exactly at fracture at normal and quarter speed', async () => {
  const audio = createAudio(); await audio.ready; await audio.unlock();
  assert.equal(audio.context.state, 'running');
  for (const rate of [1, .5, .25]) {
    audio.context.currentTime = 10;
    audio.start(0, rate);
    const source = audio.source;
    assert.equal(source.at, 10 + .65 / rate);
    assert.equal(source.offset, 0);
    assert.equal(source.playbackRate.value, rate);
    audio.context.currentTime = source.at;
    assert.ok(Math.abs(audio.time - .65) < 1e-10);
    audio.stop(); assert.equal(source.stopped, true);
  }
});

test('pause, resume, speed changes and replay cancel old audio without losing sync', async () => {
  const audio = createAudio(); await audio.ready;
  audio.start(0, 1); const first = audio.source;
  audio.context.currentTime = 11;
  audio.stop(); assert.equal(audio.time, 1); assert.equal(first.stopped, true);
  audio.context.currentTime = 15;
  assert.equal(audio.time, 1, 'the paused playhead stays still');
  audio.start(audio.time, .25);
  const resumed = audio.source;
  assert.equal(resumed.offset, .35); assert.equal(resumed.at, 15);
  audio.context.currentTime = 16;
  assert.equal(audio.time, 1.25);
  audio.start(audio.time, .5);
  assert.equal(resumed.stopped, true);
  assert.equal(audio.source.offset, .6);
  const changed = audio.source;
  audio.start(3, 1);
  assert.equal(changed.stopped, true); assert.equal(audio.source, null, 'no replay of the attack after the recording ends');
  audio.start(0, 1); assert.equal(audio.source.offset, 0);
  audio.setMuted(true); assert.equal(audio.gain.gain.value, 0);
  audio.stop(); assert.equal(audio.source, null);
});

test('new breaks can choose either recording, while transport operations retain the take', async () => {
  let selections = 0;
  const audio = new FractureAudio([{ url: 'first.wav', gain: .7 }, { url: 'second.wav', gain: .9 }], .65, {
    Context: AudioContextStub,
    fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
    random: () => selections++ === 0 ? 0 : .99,
  });
  await audio.ready;
  audio.start(0, 1, { newTake: true });
  assert.equal(audio.selected, audio.variants[0]);
  assert.equal(audio.gain.gain.value, .7);
  const original = audio.source;
  audio.start(1, .25);
  assert.equal(original.stopped, true);
  assert.equal(audio.source.buffer, audio.variants[0].buffer);
  assert.equal(audio.source.offset, .35);
  audio.stop(); audio.start(.2, 1);
  assert.equal(selections, 1, 'scrubbing before the fracture does not change its recording');
  audio.start(0, 1, { newTake: true });
  assert.equal(audio.selected, audio.variants[1]);
  assert.equal(audio.gain.gain.value, .9);
  assert.equal(selections, 2);
  audio.setMuted(true); assert.equal(audio.gain.gain.value, 0);
  audio.setMuted(false); assert.equal(audio.gain.gain.value, .9);
  audio.stop();
});

test('one missing variation falls back to the remaining recording', async () => {
  const audio = new FractureAudio([{ url: 'first.wav' }, { url: 'missing.wav' }], .65, {
    Context: AudioContextStub,
    fetchAudio: async url => ({ ok: url !== 'missing.wav', arrayBuffer: async () => new ArrayBuffer(0) }),
  });
  await audio.ready;
  assert.equal(audio.variants.length, 1);
  audio.start(0, 1, { newTake: true });
  assert.equal(audio.source.buffer, audio.variants[0].buffer);
  audio.stop();
});

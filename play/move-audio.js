const clipUrl = new URL('./audio/crystal-move.wav', import.meta.url);

export function createMoveSound() {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context;
  try { context = Context ? new Context({ latencyHint: 'interactive' }) : null; }
  catch { context = null; }
  let buffer = null;
  let active = null;
  let muted = false;

  // Decode once while the board loads, so a move can start without a fetch.
  if (context) {
    fetch(clipUrl).then(response => {
      if (!response.ok) throw new Error('Move sound could not be loaded.');
      return response.arrayBuffer();
    }).then(data => context.decodeAudioData(data)).then(decoded => {
      buffer = decoded;
    }).catch(() => { /* Audio failure must not interrupt board interaction. */ });
  }

  function unlock() {
    // Start/resume directly inside the pointer gesture for browser autoplay rules.
    if (context?.state === 'suspended') context.resume().catch(() => {});
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (muted && active) { active.stop(); active = null; }
    },
    play() {
      if (muted) return;
      unlock();
      // Skip unavailable audio rather than playing it late on a later move.
      if (!buffer || context.state !== 'running') return;
      if (active) active.stop();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        source.disconnect();
        if (active === source) active = null;
      };
      active = source;
      source.start();
    },
  };
}

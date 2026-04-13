// Aria TTS fetches audio from /openai/tts and plays it via Web Audio API.
// Mouth animation is driven by actual audio playback, not the HTTP request lifecycle.

export const createTTS = ({ onStart, onEnd }) => {
  let audioCtx = null;
  let currentSource = null;
  let muted = localStorage.getItem('iv-tts-muted') === 'true';

  const getCtx = () => {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  };

  const warmUp = () => {
    const ctx = getCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };

  const stop = () => {
    if (currentSource) {
      try {
        currentSource.stop();
      } catch {
        // no-op
      }
      currentSource = null;
    }
    onEnd?.();
  };

  const play = async (text) => {
    stop();
    if (muted || !text?.trim()) return;

    try {
      const res = await fetch('/openai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.warn('TTS request failed:', detail || res.statusText);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const ctx = getCtx();

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        if (currentSource === source) {
          currentSource = null;
          onEnd?.();
        }
      };

      currentSource = source;
      onStart?.();
      source.start(0);
    } catch (error) {
      console.warn('TTS playback failed:', error);
      onEnd?.();
    }
  };

  const setMuted = (value) => {
    muted = value;
    localStorage.setItem('iv-tts-muted', String(value));
    if (muted) {
      stop();
    }
  };

  const isMuted = () => muted;

  return { play, stop, setMuted, isMuted, warmUp };
};

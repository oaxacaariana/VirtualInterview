// Aria TTS fetches speech chunks from /openai/tts and plays them through an
// HTMLAudioElement queue so the first sentence can start sooner.

const FIRST_CHUNK_MAX = 190;
const NEXT_CHUNK_MAX = 280;

const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const splitSpeechChunks = (text) => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized];
  const chunks = [];
  let current = '';

  const getLimit = () => (chunks.length === 0 ? FIRST_CHUNK_MAX : NEXT_CHUNK_MAX);

  const flush = () => {
    if (!current) return;
    chunks.push(current.trim());
    current = '';
  };

  const takePiece = (segment, limit) => {
    if (segment.length <= limit) {
      return segment;
    }

    const slice = segment.slice(0, limit + 1);
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > Math.max(24, Math.floor(limit * 0.45))) {
      return slice.slice(0, lastSpace).trim();
    }

    return segment.slice(0, limit).trim();
  };

  const appendSegment = (segment) => {
    let remaining = normalizeWhitespace(segment);

    while (remaining) {
      const limit = getLimit();

      if (!current) {
        const piece = takePiece(remaining, limit);
        current = piece;
        remaining = normalizeWhitespace(remaining.slice(piece.length));
        if (!remaining) {
          break;
        }
        flush();
        continue;
      }

      const candidate = `${current} ${remaining}`.trim();
      if (candidate.length <= limit) {
        current = candidate;
        break;
      }

      flush();
    }
  };

  sentences.forEach((sentence) => appendSegment(sentence));
  flush();

  return chunks.filter(Boolean);
};

export const createTTS = ({ onStart, onEnd }) => {
  let muted = localStorage.getItem('iv-tts-muted') === 'true';
  let currentAudio = null;
  let currentAudioUrl = '';
  let activeToken = 0;
  let fetchControllers = [];
  let speaking = false;

  const cleanupAudio = (audio = currentAudio, objectUrl = currentAudioUrl) => {
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        // no-op
      }
      audio.removeAttribute('src');
      audio.load();
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    if (audio === currentAudio) {
      currentAudio = null;
    }
    if (objectUrl === currentAudioUrl) {
      currentAudioUrl = '';
    }
  };

  const finishSpeaking = () => {
    if (!speaking) return;
    speaking = false;
    onEnd?.();
  };

  const abortPendingFetches = () => {
    fetchControllers.forEach((controller) => controller.abort());
    fetchControllers = [];
  };

  const warmUp = () => {};

  const stop = () => {
    activeToken += 1;
    abortPendingFetches();
    cleanupAudio();
    finishSpeaking();
  };

  const fetchChunkBlob = async ({ text, voice, instructions, signal }) => {
    const res = await fetch('/openai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: voice || '',
        instructions: instructions || '',
      }),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(detail || res.statusText || 'TTS request failed');
    }

    return res.blob();
  };

  const playBlob = async (blob, token) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(blob);
    audio.src = objectUrl;
    audio.preload = 'auto';
    audio.playsInline = true;

    currentAudio = audio;
    currentAudioUrl = objectUrl;

    await new Promise((resolve, reject) => {
      const handleEnded = () => resolve();
      const handleError = () => reject(new Error('Audio playback failed.'));

      audio.onended = handleEnded;
      audio.onerror = handleError;

      audio.play().catch(reject);
    });

    if (token === activeToken) {
      cleanupAudio(audio, objectUrl);
    } else {
      cleanupAudio(audio, objectUrl);
    }
  };

  const play = async (text, options = {}) => {
    stop();
    if (muted || !text?.trim()) return;

    const chunks = splitSpeechChunks(text);
    if (!chunks.length) return;

    const token = activeToken;
    const chunkPromises = new Array(chunks.length);

    const getChunkPromise = (index) => {
      if (index >= chunks.length) {
        return null;
      }

      if (!chunkPromises[index]) {
        const controller = new AbortController();
        fetchControllers.push(controller);
        chunkPromises[index] = fetchChunkBlob({
          text: chunks[index],
          voice: options.voice,
          instructions: options.instructions,
          signal: controller.signal,
        });
      }

      return chunkPromises[index];
    };

    chunks.forEach((_, index) => {
      void getChunkPromise(index)?.catch((error) => {
        if (error?.name !== 'AbortError') {
          console.warn(`TTS chunk ${index + 1} prefetch failed:`, error);
        }
      });
    });

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        if (token !== activeToken || muted) {
          return;
        }

        const blob = await getChunkPromise(index);
        if (token !== activeToken || muted) {
          return;
        }

        if (index === 0) {
          speaking = true;
          onStart?.();
        }

        await playBlob(blob, token);
      }

      if (token === activeToken) {
        finishSpeaking();
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      console.warn('TTS playback failed:', error);
      if (token === activeToken) {
        cleanupAudio();
        finishSpeaking();
      }
    } finally {
      if (token === activeToken) {
        fetchControllers = [];
      }
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

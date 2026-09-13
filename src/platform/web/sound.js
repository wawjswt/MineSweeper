function createDefaultAudioContext() {
  const AudioContextConstructor = globalThis.AudioContext || globalThis.webkitAudioContext;
  return typeof AudioContextConstructor === "function"
    ? new AudioContextConstructor()
    : null;
}

export function createWebMergeSound({ createAudioContext = createDefaultAudioContext } = {}) {
  let audioContext = null;

  function playMerge() {
    try {
      audioContext ||= createAudioContext();
      if (!audioContext) return false;

      const resumeResult = audioContext.state === "suspended"
        ? audioContext.resume?.()
        : null;
      resumeResult?.catch?.(() => {});

      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(520, now);
      oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.12);
      return true;
    } catch (_error) {
      return false;
    }
  }

  return Object.freeze({ playMerge });
}

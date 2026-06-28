type SoundKind = "plant" | "water" | "harvest" | "review" | "result";

type AudioContextConstructor = new () => AudioContext;

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const win = window as Window & { webkitAudioContext?: AudioContextConstructor };
  const AudioContextCtor = window.AudioContext || win.webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext ||= new AudioContextCtor();
  return audioContext;
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gainValue: number, type: OscillatorType = "sine") {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

async function playSequence(notes: Array<[number, number, number, OscillatorType?]>) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
  const start = ctx.currentTime + 0.01;
  notes.forEach(([frequency, offset, duration, type]) => {
    tone(ctx, frequency, start + offset, duration, 0.06, type);
  });
}

export const soundService = {
  play(kind: SoundKind) {
    const sequences: Record<SoundKind, Array<[number, number, number, OscillatorType?]>> = {
      plant: [
        [392, 0, 0.08, "triangle"],
        [523, 0.08, 0.12, "triangle"],
      ],
      water: [
        [659, 0, 0.05, "sine"],
        [587, 0.06, 0.05, "sine"],
        [523, 0.12, 0.08, "sine"],
      ],
      harvest: [
        [523, 0, 0.08, "triangle"],
        [659, 0.08, 0.08, "triangle"],
        [784, 0.16, 0.16, "triangle"],
      ],
      review: [
        [440, 0, 0.07, "sine"],
        [660, 0.08, 0.1, "sine"],
      ],
      result: [
        [523, 0, 0.12, "triangle"],
        [659, 0.12, 0.12, "triangle"],
        [784, 0.24, 0.16, "triangle"],
        [1046, 0.42, 0.22, "sine"],
      ],
    };
    void playSequence(sequences[kind]).catch(() => undefined);
  },
};

interface SpeechRecognitionResultLike {
  transcript: string;
}

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionInstance) | undefined {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const isVoiceInputSupported = Boolean(getRecognitionCtor());
export const isVoiceOutputSupported = typeof window !== "undefined" && "speechSynthesis" in window;

export function listenOnce(onResult: (text: string) => void, onDone?: () => void) {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return;

  const recognition = new Ctor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript;
    if (transcript) onResult(transcript);
  };
  recognition.onend = () => onDone?.();
  recognition.onerror = () => onDone?.();

  recognition.start();
}

export function speak(text: string) {
  if (!isVoiceOutputSupported) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  utterance.pitch = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /male|daniel|arthur|google uk english male/i.test(v.name));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

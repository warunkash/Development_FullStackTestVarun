import { useRef, useState } from "react";
import { useAppStore } from "../state/store";
import { handleCommand } from "./commandParser";
import { isVoiceInputSupported, isVoiceOutputSupported, listenOnce, speak } from "./speech";

export function JarvisPanel() {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useAppStore((s) => s.messages);
  const pushMessage = useAppStore((s) => s.pushMessage);
  const watchlist = useAppStore((s) => s.watchlist);
  const quotes = useAppStore((s) => s.quotes);
  const addSymbol = useAppStore((s) => s.addSymbol);
  const removeSymbol = useAppStore((s) => s.removeSymbol);
  const select = useAppStore((s) => s.select);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushMessage({ from: "user", text: trimmed });

    const reply = handleCommand(trimmed, { watchlist, quotes, addSymbol, removeSymbol, select });
    pushMessage({ from: "jarvis", text: reply });
    if (voiceOn) speak(reply);

    setInput("");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function handleMic() {
    if (!isVoiceInputSupported || listening) return;
    setListening(true);
    listenOnce(
      (text) => submit(text),
      () => setListening(false),
    );
  }

  return (
    <div className="jarvis-panel">
      <div className="jarvis-header">
        <span className="jarvis-dot" />
        J.A.R.V.I.S.
        {isVoiceOutputSupported && (
          <button className="jarvis-voice-toggle" onClick={() => setVoiceOn((v) => !v)} title="Toggle voice reply">
            {voiceOn ? "🔊" : "🔇"}
          </button>
        )}
      </div>

      <div className="jarvis-messages" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`jarvis-msg jarvis-msg-${m.from}`}>
            <span className="jarvis-msg-label">{m.from === "jarvis" ? "JARVIS" : "YOU"}</span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>

      <form
        className="jarvis-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask JARVIS... e.g. 'show TSLA'"
          autoComplete="off"
        />
        {isVoiceInputSupported && (
          <button type="button" className={`jarvis-mic ${listening ? "listening" : ""}`} onClick={handleMic}>
            {listening ? "..." : "🎙"}
          </button>
        )}
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

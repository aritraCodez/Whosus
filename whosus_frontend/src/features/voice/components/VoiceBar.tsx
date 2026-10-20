import { useGame } from "@/features/game/model/game-store";
import { voice } from "@/features/voice/voice-client";
import { HeadphoneOff, Headphones, Mic, MicOff } from "lucide-react";
export function VoiceBar() {
  const s = useGame();
  const voiceOff = s.voiceStatus === "off" || s.voiceStatus === "error";
  const micOn = !voiceOff && !s.deafened && (!s.muted || s.ptt);
  const listening = !voiceOff && !s.deafened;
  const microphoneLabel = micOn ? "Mute microphone" : "Unmute microphone";
  const listeningLabel = voiceOff
    ? "Join voice and listen (mic stays muted)"
    : s.deafened
      ? "Turn listening on"
      : "Turn listening off";
  return (
    <div className="voice-bar">
      <span className={`voice-dot ${s.voiceStatus === "live" ? "live" : ""}`} />
      <div className="voice-label">
        <strong>
          {s.room?.phase === "playing"
            ? s.room.players.find((p) => p.id === s.id)?.alive
              ? "PROXIMITY"
              : "GHOST CHANNEL"
            : "CREW CHANNEL"}
        </strong>
        <small>
          {s.voiceStatus === "off"
            ? "Tap to listen · mic off"
            : s.voiceStatus === "live"
              ? s.deafened
                ? "Listening off · mic off"
                : micOn
                  ? "Listening · mic on"
                  : "Listening · mic off"
              : s.voiceStatus}
        </small>
      </div>
      <button
        className={`icon ${micOn ? "active" : ""}`}
        onClick={() => voice.mute()}
        title={`${microphoneLabel} (M)`}
        aria-label={microphoneLabel}
        aria-pressed={micOn}
      >
        {micOn ? <Mic size={19} /> : <MicOff size={19} />}
      </button>
      <button
        className={`icon ${listening ? "active" : ""}`}
        onClick={() => voice.deafen()}
        title={listeningLabel}
        aria-label={listeningLabel}
        aria-pressed={listening}
      >
        {listening ? <Headphones size={19} /> : <HeadphoneOff size={19} />}
      </button>
      <button
        className={`talk-button ${s.ptt ? "held" : ""}`}
        aria-label="Hold to talk"
        aria-pressed={s.ptt}
        title="Hold to talk (V)"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          voice.ptt(true);
        }}
        onPointerUp={() => voice.ptt(false)}
        onPointerCancel={() => voice.ptt(false)}
        onLostPointerCapture={() => voice.ptt(false)}
      >
        HOLD <kbd>V</kbd>
      </button>
      {s.playbackBlocked && (
        <button className="audio-unlock" onClick={voice.resume}>
          Tap to hear players
        </button>
      )}
    </div>
  );
}

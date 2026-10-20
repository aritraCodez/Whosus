import { useGame } from "@/features/game/model/game-store";
import { voice } from "@/features/voice/voice-client";
import {
Headphones,
Mic,
MicOff,
VolumeX
} from "lucide-react";
export function VoiceBar() {
  const s = useGame();
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
            ? "Tap mic to join voice"
            : s.voiceStatus === "live"
              ? s.muted
                ? "Mic muted · hold V to talk"
                : "Voice connected"
              : s.voiceStatus}
        </small>
      </div>
      <button
        className={`icon ${!s.muted ? "active" : ""}`}
        onClick={() => voice.mute()}
        title="Microphone (M)"
        aria-label="Toggle microphone"
      >
        {s.muted ? <MicOff size={19} /> : <Mic size={19} />}
      </button>
      <button
        className="icon"
        onClick={() => voice.deafen()}
        title="Deafen"
        aria-label="Toggle deafen"
      >
        {s.deafened ? <VolumeX size={19} /> : <Headphones size={19} />}
      </button>
      <button
        className={`talk-button ${s.ptt ? "held" : ""}`}
        onPointerDown={(e) => {
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
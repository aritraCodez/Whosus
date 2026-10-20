import { useGame } from "@/features/game/model/game-store";
import { send } from "@/services/game-socket";
import { ArrowRight, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
export function ChatPanel() {
  const s = useGame(),
    [text, setText] = useState("");
  const messages = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const list = messages.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [s.chat.length, s.chatOpen]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = panel.current;
    if (!s.chatOpen || !viewport || !element) return;
    const resize = () => {
      element.style.setProperty(
        "--chat-viewport-height",
        `${viewport.height}px`,
      );
      element.style.setProperty(
        "--chat-keyboard-offset",
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    };
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, [s.chatOpen]);
  if (!s.chatOpen) return null;
  const me = s.room?.players.find((p) => p.id === s.id);
  return (
    <aside className="chat-panel" ref={panel}>
      <header>
        <strong>
          <MessageCircle size={15} /> {me?.alive ? "Crew chat" : "Ghost chat"}
        </strong>
        <button
          className="icon"
          aria-label="Close chat"
          onClick={() => s.set({ chatOpen: false })}
        >
          <X size={17} />
        </button>
      </header>
      <div className="chat-messages" ref={messages}>
        {s.chat.length ? (
          s.chat.map((m) => (
            <div key={m.id}>
              <span>
                {m.name}{" "}
                <time>
                  {new Date(m.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                {m.channel === "ghost" ? " · ghost" : ""}
              </span>
              <p>{m.text}</p>
            </div>
          ))
        ) : (
          <div className="empty">
            <MessageCircle size={22} />
            <p>
              Start with a friendly hello.
              <br />
              Save the accusations for later.
            </p>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) {
            send({ type: "chat", text });
            setText("");
          }
        }}
      >
        <input
          autoFocus={!window.matchMedia("(pointer: coarse)").matches}
          enterKeyHint="send"
          maxLength={280}
          aria-label="Chat message"
          placeholder={
            me?.alive ? "Message your crew…" : "Ghost message (ghosts only)…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button aria-label="Send message" disabled={!text.trim()}>
          <ArrowRight size={18} />
        </button>
      </form>
    </aside>
  );
}

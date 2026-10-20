import { Modal } from "@/components/ui/Modal";
import { BotIcon } from '@/features/appearance/components/BotIcon';
import { sound } from "@/features/game/audio/sounds";
import { useGame } from "@/features/game/model/game-store";
import { COLORS } from "@/features/game/model/types";
import { RoomForm } from '@/features/lobby/components/RoomForm';
import {
ArrowDown,
ArrowRight,
Check,
ChevronRight,
HelpCircle,
MessageCircle,
Mic,
Pencil,
Plus,
Radio,
Settings,
Shield,
Shirt,
Skull,
Users
} from "lucide-react";
import { useRef,useState } from "react";
export function Menu({
  name,
  setName,
  color,
  setColor,
  hat,
}: {
  name: string;
  setName: (n: string) => void;
  color: number;
  setColor: (n: number) => void;
  hat: string;
}) {
  const [form, setForm] = useState<"create" | "join" | "find" | null>(null),
    [help, setHelp] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const editName = () => {
    nameInput.current?.focus();
    nameInput.current?.select();
  };
  return (
    <div className="menu">
      <header className="masthead">
        <a className="wordmark" href="#" aria-label="WhoSus home">
          <span className="mark-eyes">••</span> who<span>sus?</span>
        </a>
        <nav>
          <span className="nav-active">PLAY</span>
          <button onClick={() => setHelp(true)}>
            FIELD GUIDE <HelpCircle size={14} />
          </button>
        </nav>
        <button
          className="icon"
          aria-label="Settings"
          onClick={() => useGame.setState({ settings: true })}
        >
          <Settings size={20} />
        </button>
      </header>
      <main className="menu-main">
        <section className="intro">
          <div className="eyebrow">
            <span /> A SMALL CREW. A BIG LITTLE MYSTERY.
          </div>
          <h1>
            Good friends.
            <br />
            Bad <span>alibis.</span>
            <svg viewBox="0 0 260 20" aria-hidden="true">
              <path d="M4 13 Q130 -2 254 10 M25 18 Q140 6 232 13" />
            </svg>
          </h1>
          <p className="lead">
            Keep the station running.
            <br />
            Keep an eye on your friends.
            <br />
            <strong>Someone’s not who they say they are.</strong>
          </p>
          <div
            className="player-custom"
            onClick={(e) => {
              if (!(e.target instanceof HTMLInputElement)) editName();
            }}
          >
            <BotIcon color={COLORS[color]} />
            <div>
              <label htmlFor="name">YOUR EXPLORER</label>
              <input
                ref={nameInput}
                id="name"
                aria-label="Explorer name"
                value={name}
                maxLength={18}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </div>
            <button
              type="button"
              className="pencil"
              aria-label="Edit explorer name"
              onClick={editName}
            >
              <Pencil size={20} />
            </button>
          </div>
          <div className="custom-options">
            <div className="colors" aria-label="Character color">
              {COLORS.slice(0, 8).map((c, i) => (
                <button
                  key={c}
                  aria-label={`Color ${i + 1}`}
                  aria-pressed={color === i}
                  onClick={() => setColor(i)}
                  style={{ background: c }}
                >
                  {color === i && <Check size={14} />}
                </button>
              ))}
            </div>
            <button className="secondary wardrobe-launch" onClick={() => useGame.setState({ wardrobe: true })}><Shirt size={18} /> Customize character</button>
          </div>
          <button
            className="primary create"
            onClick={() => {
              sound();
              setForm("create");
            }}
          >
            <Plus size={21} />
            <span>Create a room</span>
            <ArrowRight size={20} />
          </button>
          <div className="join-actions">
            <button className="secondary" onClick={() => setForm("join")}>
              <Users size={17} /> Join with code
            </button>
            <button className="text-button" onClick={() => setForm("find")}>
              Find a crew <ChevronRight size={16} />
            </button>
          </div>
          <div className="play-notes">
            <span>
              <Users size={13} /> 4–12 players
            </span>
            <i />
            <span>
              <Mic size={13} /> Proximity voice
            </span>
            <i />
            <span>Free to play</span>
          </div>
        </section>
        <section className="scene-copy">
          <div className="station-tag">
            <span className="live-dot" /> NEXT STOP{" "}
            <span>01 / CLOUDLINE STATION</span>
          </div>
          <div className="floating-note">
            <span className="note-icon">
              <Radio size={19} />
            </span>
            <div>
              <strong>“I was in Botanical.”</strong>
              <small>Sure you were, Miso.</small>
              <small className="hero-controls-hint">
                WASD / arrows · swipe left or right to move
              </small>
            </div>
            <span className="note-dot" />
          </div>
          <div className="destination">
            <span className="tiny-label">SOMEWHERE ABOVE SUSPICION</span>
            <h2>
              Cloudline Station <ArrowDown size={20} />
            </h2>
            <p>
              A peaceful little outpost.
              <br />
              Until you arrive.
            </p>
          </div>
          <span className="coordinate">
            KILLER APPROACHING &nbsp; / &nbsp; COORDINATES SHARED
          </span>
        </section>
      </main>
      <footer className="menu-footer">
        <span>
          <span className="live-dot" /> ALL ABOARD, TRUST OPTIONAL.
        </span>
        <span>
          WHOSUS? <b className="footer-killer">SOMEONE'S NOT WHO THEY SEEM</b>
        </span>
      </footer>
      {form && (
        <RoomForm
          mode={form}
          name={name}
          setName={setName}
          color={color}
          hat={hat}
          close={() => setForm(null)}
        />
      )}
      {help && (
        <Modal
          title="Trust your crew. Mostly."
          close={() => setHelp(false)}
          wide
        >
          <div className="guide-grid">
            <article>
              <Shield />
              <h3>Keep things running.</h3>
              <p>
                Crewmates visit the four marked consoles and complete their
                circuits. Finish every task or vote out every killer to win.
                Ghosts can still finish tasks.
              </p>
            </article>
            <article>
              <Skull />
              <h3>Be a little suspicious.</h3>
              <p>
                killers blend in, use service ducts and eliminate nearby crew.
                Sabotage the reactor to create a 55-second emergency. Crew can
                repair it at the reactor console.
              </p>
            </article>
            <article>
              <MessageCircle />
              <h3>Talk it out.</h3>
              <p>
                Report a body or call a meeting at the central beacon. Discuss,
                then vote or skip. A tie ejects nobody. During a match, living
                crew can talk and text with the living; ghosts can talk and text
                with other ghosts, never the living.
              </p>
            </article>
          </div>
          <div className="controls-guide">
            <span>
              <kbd>W A S D</kbd> Move
            </span>
            <span>
              <kbd>E</kbd> Interact
            </span>
            <span>
              <kbd>R</kbd> Report
            </span>
            <span>
              <kbd>Tab</kbd> Map
            </span>
            <span>
              <kbd>M</kbd> Mic
            </span>
            <span>
              <kbd>V</kbd> Hold to talk
            </span>
            <span>
              <kbd>Enter</kbd> Chat
            </span>
            <span>
              <kbd>F</kbd> Eliminate
            </span>
            <span>
              <kbd>Q</kbd> Duct
            </span>
          </div>
          <p className="hint">
            On a phone, use the movement pad and action buttons. Landscape gives
            you more room. Enable voice with the microphone button; use
            headphones for the best experience.
          </p>
          <button className="primary full" onClick={() => setHelp(false)}>
            I have a perfectly good alibi <ArrowRight size={18} />
          </button>
        </Modal>
      )}
    </div>
  );
}
import { backendWebSocketUrl } from "./backend";
import { useGame } from "./store";

type TestPlayerSession = {
  roomCode: string;
  name: string;
  id?: string;
  ready: boolean;
  socket: WebSocket;
  closing: boolean;
};

const sessions: TestPlayerSession[] = [];
let nextName = 1;
let heartbeat: ReturnType<typeof setInterval> | undefined;

function send(session: TestPlayerSession, message: Record<string, unknown>) {
  if (session.socket.readyState === WebSocket.OPEN)
    session.socket.send(JSON.stringify(message));
}

function removeSession(session: TestPlayerSession) {
  const index = sessions.indexOf(session);
  if (index >= 0) sessions.splice(index, 1);
  if (sessions.length === 0 && heartbeat) {
    clearInterval(heartbeat);
    heartbeat = undefined;
  }
}

function addTestPlayer(roomCode: string): Promise<void> {
  const name = `Test Crew ${nextName++}`;
  const socket = new WebSocket(backendWebSocketUrl());
  const session: TestPlayerSession = {
    roomCode,
    name,
    ready: false,
    socket,
    closing: false,
  };
  sessions.push(session);

  if (!heartbeat) {
    heartbeat = setInterval(() => {
      for (const active of sessions) send(active, { type: "ping" });
    }, 15_000);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      fail(new Error(`Timed out adding ${name}.`));
    }, 10_000);

    function fail(error: Error) {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      } else {
        useGame.setState({ error: error.message });
      }
      session.closing = true;
      removeSession(session);
      socket.close();
    }

    socket.onopen = () => {
      send(session, {
        type: "join",
        code: roomCode,
        name,
        color: (nextName - 2) % 12,
        hat: "sprout",
      });
    };

    socket.onmessage = (event) => {
      let message: { type?: string; id?: string; message?: string; room?: { phase: string; players: { id: string; ready: boolean }[] } };
      try {
        message = JSON.parse(event.data);
      } catch {
        fail(new Error(`Received an invalid response while adding ${name}.`));
        return;
      }

      if (message.type === "joined" && message.id) {
        session.id = message.id;
        send(session, { type: "action", action: "ready" });
      } else if (message.type === "snapshot" && message.room) {
        const player = message.room.players.find((candidate) => candidate.id === session.id);
        if (player) {
          session.ready = player.ready;
          if (player.ready && !settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
        }
      } else if (message.type === "error") {
        fail(new Error(message.message || `Could not add ${name}.`));
      }
    };

    socket.onerror = () => {
      fail(new Error(`Could not connect ${name} to the game server.`));
    };

    socket.onclose = () => {
      removeSession(session);
      if (!session.closing && settled)
        useGame.setState({ error: `${name} disconnected. Add test players again.` });
      else if (!settled)
        fail(new Error(`Connection closed while adding ${name}.`));
    };
  });
}

export async function fillLobbyWithTestPlayers(
  roomCode: string,
  players: { id: string; ready: boolean }[],
) {
  const active = sessions.filter(
    (session) =>
      session.roomCode === roomCode &&
      session.socket.readyState === WebSocket.OPEN,
  );
  for (const session of active) {
    session.ready =
      players.find((player) => player.id === session.id)?.ready ?? false;
    if (!session.ready) send(session, { type: "action", action: "ready" });
  }
  const readyDeadline = Date.now() + 10_000;
  while (active.some((session) => !session.ready)) {
    if (active.some((session) => session.socket.readyState !== WebSocket.OPEN))
      throw new Error("A test player disconnected before becoming ready.");
    if (Date.now() >= readyDeadline)
      throw new Error("Timed out waiting for test players to become ready.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const needed = Math.max(0, 4 - players.length);
  for (let index = 0; index < needed; index++)
    await addTestPlayer(roomCode);
}

export function closeTestPlayers() {
  for (const session of [...sessions]) {
    session.closing = true;
    send(session, { type: "leave" });
    session.socket.close();
    removeSession(session);
  }
}

// Shared transport access keeps WebRTC signaling independent of the game client.
let socket: WebSocket | null = null;

export function setGameSocket(value: WebSocket | null) { socket = value; }

export function send(data: Record<string, unknown>): boolean {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(data));
  return true;
}

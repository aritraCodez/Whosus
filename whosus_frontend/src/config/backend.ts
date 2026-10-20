import { parseBackendOrigin } from "./environment";
const backendOrigin = parseBackendOrigin(import.meta.env.VITE_BACKEND_ORIGIN);

export function backendApiUrl(path: string) {
  return backendOrigin ? new URL(path, `${backendOrigin}/`).toString() : path;
}

export function backendWebSocketUrl() {
  if (!backendOrigin)
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

  const url = new URL("/ws", backendOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

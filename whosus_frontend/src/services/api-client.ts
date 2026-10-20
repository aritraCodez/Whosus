import { backendApiUrl } from "@/config/backend";

export async function getJson(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(backendApiUrl(path), { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
  return response.json();
}

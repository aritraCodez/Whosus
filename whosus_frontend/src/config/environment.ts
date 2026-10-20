/** Only public HTTP(S) backend origins belong in the browser bundle. */
export function parseBackendOrigin(
  value: string | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/+$/, "")
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      "VITE_BACKEND_ORIGIN must be an HTTP(S) origin without credentials, a path, query, or fragment.",
    );
  }
}

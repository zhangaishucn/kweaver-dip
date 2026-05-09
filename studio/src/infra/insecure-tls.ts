/**
 * Returns whether a URL string uses the HTTPS scheme.
 *
 * @param urlString Absolute URL string.
 * @returns True when the protocol is `https:`.
 */
export function isHttpsUrlString(urlString: string): boolean {
  return new URL(urlString).protocol === "https:";
}

/**
 * Temporarily disables TLS certificate verification for the current process.
 *
 * Node's `fetch` does not expose per-request TLS options; upstream HTTPS calls use this for
 * self-signed or privately issued backend certificates. The prior value is restored immediately
 * after the response body is read.
 *
 * @returns A callback that restores previous TLS verification behavior.
 */
export function applyInsecureTlsSetting(): () => void {
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  return () => {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      return;
    }

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
  };
}

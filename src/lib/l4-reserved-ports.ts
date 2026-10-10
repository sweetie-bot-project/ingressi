/**
 * Reserved ports for L4 proxy host listen addresses.
 *
 * Ingressi's generated Caddy config always binds :2019 for its admin API.
 * Port 2019 is reserved for every L4 host, TCP or UDP: a standalone layer4
 * server there would be a second listener on the same port, and Caddy sets
 * SO_REUSEPORT on every listener, so the bind succeeds and the kernel
 * silently splits connections between the two sockets (~50% of handshakes
 * fail). See issue #295.
 *
 * Ports :80/:443 (the HTTP app) are reserved only for UDP. A TCP L4 host on
 * one of them is safe: buildL4Servers (src/lib/caddy.ts) attaches it to the
 * HTTP server's own listener as a `layer4` listener wrapper instead of a
 * second listener, so SSH, a database protocol, etc. can share :443 with the
 * HTTPS proxy hosts without colliding. There is no such exemption for UDP:
 * caddy-l4's ListenerWrapper doesn't support UDP, and the HTTP app itself may
 * open an HTTP/3 (QUIC) listener on :443/udp, so a UDP L4 host there is
 * always a second, colliding listener.
 */
export const RESERVED_L4_ADMIN_PORT = 2019;
export const HTTP_L4_PORTS = [80, 443] as const;

/** Every port reserved regardless of protocol — for call sites with no protocol on hand. */
export const RESERVED_L4_PORTS = [RESERVED_L4_ADMIN_PORT, ...HTTP_L4_PORTS] as const;

/** Extract the TCP/UDP port from an L4 listen address (":PORT" or "HOST:PORT"). */
export function extractL4ListenPort(listenAddress: string): number | null {
  const match = listenAddress.trim().match(/:(\d+)$/);
  if (!match) return null;
  const port = parseInt(match[1], 10);
  return port >= 1 && port <= 65535 ? port : null;
}

/**
 * True if an L4 host with this protocol/listen address would collide with one
 * of Ingressi's own Caddy listeners (issue #295). `protocol` defaults to
 * "udp" — the conservative choice — so a caller that doesn't have it handy
 * keeps the old, unconditional behavior for :80/:443.
 */
export function isReservedL4Port(listenAddress: string, protocol: "tcp" | "udp" = "udp"): boolean {
  const port = extractL4ListenPort(listenAddress);
  if (port === null) return false;
  if (port === RESERVED_L4_ADMIN_PORT) return true;
  return protocol === "udp" && (HTTP_L4_PORTS as readonly number[]).includes(port);
}

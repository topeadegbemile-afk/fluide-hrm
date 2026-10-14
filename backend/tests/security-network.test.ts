import { describe, expect, it } from "vitest";
import { clientIpMatchesApprovedNetworks, normalizeApprovedNetworks } from "../src/services/security.service.js";

describe("approved office network validation", () => {
  it("normalizes and deduplicates individual addresses and CIDRs", () => {
    expect(normalizeApprovedNetworks(["192.0.2.10", "192.0.2.10", "2001:db8::/32"])).toEqual([
      "192.0.2.10", "2001:db8::/32",
    ]);
  });

  it("rejects malformed addresses and CIDR ranges", () => {
    expect(() => normalizeApprovedNetworks(["not-an-ip"])).toThrow("Invalid IP address or CIDR range");
    expect(() => normalizeApprovedNetworks(["192.0.2.1/99"])).toThrow("Invalid IP address or CIDR range");
  });

  it("matches IPv4 and IPv6 networks without accepting a different address family", () => {
    expect(clientIpMatchesApprovedNetworks("192.0.2.42", ["192.0.2.0/24"])).toBe(true);
    expect(clientIpMatchesApprovedNetworks("192.0.3.42", ["192.0.2.0/24"])).toBe(false);
    expect(clientIpMatchesApprovedNetworks("2001:db8::7", ["2001:db8::/32"])).toBe(true);
    expect(clientIpMatchesApprovedNetworks("192.0.2.42", ["2001:db8::/32"])).toBe(false);
    expect(clientIpMatchesApprovedNetworks("not-an-ip", ["0.0.0.0/0"])).toBe(false);
  });
});

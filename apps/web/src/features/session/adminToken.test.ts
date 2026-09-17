import { describe, expect, it } from "vitest";
import { adminRecoveryUrl, readAdminTokenFromHash } from "./adminToken";

const token = "a".repeat(64);

describe("readAdminTokenFromHash", () => {
  it("reads a well formed token", () => {
    expect(readAdminTokenFromHash(`#admin=${token}`)).toBe(token);
  });

  it("reads it alongside other fragment parameters", () => {
    expect(readAdminTokenFromHash(`#foo=1&admin=${token}`)).toBe(token);
  });

  it("ignores a fragment without a token", () => {
    expect(readAdminTokenFromHash("#something-else")).toBeNull();
    expect(readAdminTokenFromHash("")).toBeNull();
  });

  it("rejects anything that is not 64 hex characters", () => {
    expect(readAdminTokenFromHash("#admin=short")).toBeNull();
    expect(readAdminTokenFromHash(`#admin=${"z".repeat(64)}`)).toBeNull();
  });
});

describe("adminRecoveryUrl", () => {
  it("puts the token in the fragment, never the path or query", () => {
    const url = adminRecoveryUrl("https://vbs.example", "ABCDEFGHJKLM", token);
    expect(url).toBe(`https://vbs.example/s/ABCDEFGHJKLM#admin=${token}`);
    expect(new URL(url).search).toBe("");
  });
});

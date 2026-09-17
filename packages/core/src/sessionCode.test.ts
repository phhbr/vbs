import { describe, expect, it } from "vitest";
import {
  formatSessionCode,
  isValidSessionCode,
  normalizeSessionCode,
} from "./sessionCode";

describe("normalizeSessionCode", () => {
  it("upper-cases and strips separators, matching the database function", () => {
    expect(normalizeSessionCode("abcd-efgh jklm")).toBe("ABCDEFGHJKLM");
  });

  it("leaves an already canonical code alone", () => {
    expect(normalizeSessionCode("ABCDEFGHJKLM")).toBe("ABCDEFGHJKLM");
  });
});

describe("formatSessionCode", () => {
  it("groups a code in fours for display", () => {
    expect(formatSessionCode("ABCDEFGHJKLM")).toBe("ABCD-EFGH-JKLM");
  });

  it("regroups a code that already carries separators", () => {
    expect(formatSessionCode("abc-defghjklm")).toBe("ABCD-EFGH-JKLM");
  });
});

describe("isValidSessionCode", () => {
  it("accepts a canonical code", () => {
    expect(isValidSessionCode("ABCDEFGHJKLM")).toBe(true);
  });

  it("accepts a code the user typed with dashes and lower case", () => {
    expect(isValidSessionCode("abcd-efgh-jklm")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isValidSessionCode("ABCDEFGHJKL")).toBe(false);
  });

  it("rejects the ambiguous characters the alphabet leaves out", () => {
    expect(isValidSessionCode("ABCDEFGHIJKL")).toBe(false);
    expect(isValidSessionCode("ABCDEFGHJK0M")).toBe(false);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { AuthGate } from "./AuthGate";

const { ensureAnonymousUserSpy } = vi.hoisted(() => ({
  ensureAnonymousUserSpy: vi.fn(),
}));

vi.mock("./auth", () => ({
  ensureAnonymousUser: ensureAnonymousUserSpy,
}));

describe("AuthGate", () => {
  it("signs in with no captcha step when VITE_TURNSTILE_SITE_KEY is unset", async () => {
    ensureAnonymousUserSpy.mockResolvedValue({ id: "user-1" });

    render(
      <AuthGate>
        <p>protected content</p>
      </AuthGate>,
    );

    await waitFor(() =>
      expect(screen.getByText("protected content")).toBeInTheDocument(),
    );
    // Called with undefined: no widget rendered, so no token was ever
    // produced — matches the "hermetic by omission" design (CLAUDE.md).
    expect(ensureAnonymousUserSpy).toHaveBeenCalledWith(undefined);
  });

  it("shows a failure message when sign-in rejects", async () => {
    ensureAnonymousUserSpy.mockRejectedValue(new Error("network error"));

    render(
      <AuthGate>
        <p>protected content</p>
      </AuthGate>,
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });
});

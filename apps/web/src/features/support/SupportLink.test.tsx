import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SupportLink } from "./SupportLink";
import "../../i18n";

beforeAll(async () => {
  const { default: i18n } = await import("../../i18n");
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SupportLink", () => {
  it("renders nothing when VITE_SUPPORT_URL is unset", () => {
    vi.stubEnv("VITE_SUPPORT_URL", "");

    const { container } = render(<SupportLink />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders an outbound link with the stubbed URL when set", () => {
    vi.stubEnv("VITE_SUPPORT_URL", "https://buymeacoffee.com/bruchner.dev");

    render(<SupportLink />);

    const link = screen.getByRole("link", { name: /Kaffee spendieren/ });
    expect(link).toHaveAttribute(
      "href",
      "https://buymeacoffee.com/bruchner.dev",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

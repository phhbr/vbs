import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { App } from "./App";
import "./i18n";

beforeAll(async () => {
  const { default: i18n } = await import("./i18n");
  await i18n.changeLanguage("de");
});

describe("App", () => {
  it("renders the app title on the home route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Vorgangsbewertungsstelle")).toBeInTheDocument();
    expect(screen.getByText("Home — Platzhalter")).toBeInTheDocument();
  });

  it("renders the session code from the URL", () => {
    render(
      <MemoryRouter initialEntries={["/s/ABCD-1234"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Session ABCD-1234 — Platzhalter"),
    ).toBeInTheDocument();
  });
});

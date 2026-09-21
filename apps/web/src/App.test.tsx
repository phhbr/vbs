import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import "./i18n";

beforeAll(async () => {
  const { default: i18n } = await import("./i18n");
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("home screen", () => {
  it("offers both creating and joining a session", () => {
    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "Neue Sitzung eröffnen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sitzung beitreten" }),
    ).toBeInTheDocument();
  });

  it("labels every field so it is reachable by name", () => {
    renderApp("/");

    expect(screen.getByLabelText("Dein Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Sitzungs-Code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fibonacci", pressed: true }),
    ).toBeInTheDocument();
  });

  it("keeps the create button disabled until a nickname is entered", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const submit = screen.getByRole("button", { name: "Sitzung eröffnen" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Dein Name"), "Ada");
    expect(submit).toBeEnabled();
  });

  it("rejects a malformed code inline instead of navigating", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.type(screen.getByLabelText("Sitzungs-Code"), "NOPE");
    await user.click(screen.getByRole("button", { name: "Beitreten" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ein Code besteht aus 12 Zeichen",
    );
    expect(
      screen.getByRole("heading", { name: "Sitzung beitreten" }),
    ).toBeInTheDocument();
  });

  it("accepts a code typed with dashes and lower case", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.type(screen.getByLabelText("Sitzungs-Code"), "abcd-efgh-jklm");
    await user.click(screen.getByRole("button", { name: "Beitreten" }));

    // Only the inline format check is this test's concern — not whatever the
    // join request that fires next does. Asserting "no alert at all" was
    // flaky: a real network call to a Supabase that isn't up yet can reject
    // fast enough to render its own failure alert before this runs.
    expect(
      screen.queryByText("Ein Code besteht aus 12 Zeichen"),
    ).not.toBeInTheDocument();
  });

  it("links to the legal pages from the footer", () => {
    renderApp("/");

    expect(
      screen.getByRole("link", { name: "Impressum" }),
    ).toHaveAttribute("href", "/impressum");
    expect(
      screen.getByRole("link", { name: "Datenschutz" }),
    ).toHaveAttribute("href", "/datenschutz");
  });

  it("omits the support link and its separator when VITE_SUPPORT_URL is unset", () => {
    vi.stubEnv("VITE_SUPPORT_URL", "");
    renderApp("/");

    expect(
      screen.queryByRole("link", { name: "Kaffee spendieren" }),
    ).not.toBeInTheDocument();
    // Two segments means exactly one separator — a stray trailing "·"
    // would mean the filter in App.tsx let a falsy segment through.
    expect(screen.getByRole("contentinfo").textContent?.match(/·/g)).toHaveLength(1);
  });

  it("adds the support link to the footer when VITE_SUPPORT_URL is set", () => {
    vi.stubEnv("VITE_SUPPORT_URL", "https://buymeacoffee.com/bruchner.dev");
    renderApp("/");

    expect(
      screen.getByRole("link", { name: /Kaffee spendieren/ }),
    ).toHaveAttribute("href", "https://buymeacoffee.com/bruchner.dev");
    expect(screen.getByRole("contentinfo").textContent?.match(/·/g)).toHaveLength(2);
  });
});

describe("legal pages", () => {
  it("renders the legal notice with the operator's contact details", () => {
    renderApp("/impressum");

    expect(
      screen.getByRole("heading", { name: "Impressum", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Angaben gemäß § 5 DDG" }),
    ).toHaveTextContent("Philipp Bruchner");
    expect(
      screen.getByRole("link", { name: "blog@phhbr.de" }),
    ).toHaveAttribute("href", "mailto:blog@phhbr.de");
    expect(
      screen.getByRole("link", { name: "Zurück zur Startseite" }),
    ).toHaveAttribute("href", "/");
  });

  it("renders the privacy policy", () => {
    renderApp("/datenschutz");

    expect(
      screen.getByRole("heading", { name: "Datenschutzerklärung", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Verantwortlicher" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Zurück zur Startseite" }),
    ).toHaveAttribute("href", "/");
  });
});

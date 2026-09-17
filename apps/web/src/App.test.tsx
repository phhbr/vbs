import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { App } from "./App";
import "./i18n";

beforeAll(async () => {
  const { default: i18n } = await import("./i18n");
  await i18n.changeLanguage("de");
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
      screen.getByRole("group", { name: "Kartensatz" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Fibonacci" })).toBeChecked();
  });

  it("keeps the create button disabled until a nickname is entered", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const submit = screen.getByRole("button", { name: "[ Sitzung eröffnen ]" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Dein Name"), "Ada");
    expect(submit).toBeEnabled();
  });

  it("rejects a malformed code inline instead of navigating", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.type(screen.getByLabelText("Sitzungs-Code"), "NOPE");
    await user.click(screen.getByRole("button", { name: "[ Beitreten ]" }));

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
    await user.click(screen.getByRole("button", { name: "[ Beitreten ]" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

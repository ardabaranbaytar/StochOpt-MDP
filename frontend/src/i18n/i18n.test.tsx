import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { de } from "./de";
import { en } from "./en";
import { detectLocale } from "./locales";
import { tr } from "./tr";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  fetchMock = vi.fn((url: string) => (url === "/health" ? json({ status: "ok" }) : json({ detail: "x" }, 400)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("language choice", () => {
  it("starts in English and follows the flag buttons, remembering the choice", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("tab", { name: en.tabs.summary })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");

    await user.click(screen.getByRole("button", { name: "Türkçe" }));
    expect(screen.getByRole("tab", { name: tr.tabs.summary })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: tr.settings.calculate })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("tr");
    expect(localStorage.getItem("lang")).toBe("tr");
    // numbers follow the language too: "%32,0" instead of "32.0%"
    expect(screen.getAllByTestId("kpi-value")[0].textContent).toMatch(/^−?%\d+,\d$/);

    await user.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(screen.getByRole("tab", { name: de.tabs.summary })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("de");
  });

  it("opens in the language of a ?lang= link and keeps it", () => {
    window.history.replaceState({}, "", "/?lang=de");
    render(<App />);
    expect(screen.getByRole("tab", { name: de.tabs.summary })).toBeInTheDocument();
    expect(localStorage.getItem("lang")).toBe("de");
  });

  it("ignores an unknown ?lang= value and falls back to the saved or browser language", () => {
    window.history.replaceState({}, "", "/?lang=xx");
    expect(detectLocale()).toBe("en");
    localStorage.setItem("lang", "tr");
    expect(detectLocale()).toBe("tr");
    window.history.replaceState({}, "", "/?lang=de");
    expect(detectLocale()).toBe("de");
  });

  it("shows the unreachable-server error in the chosen language", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === "/health" ? json({ status: "ok" }) : Promise.reject(new TypeError("Failed to fetch")),
    );
    window.history.replaceState({}, "", "/?lang=tr");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: tr.settings.calculate }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(tr.errors.unreachable));
  });

  it("explains an input mistake in the chosen language", async () => {
    window.history.replaceState({}, "", "/?lang=de");
    const user = userEvent.setup();
    render(<App />);
    const mean = screen.getByLabelText(/Ø pro Tag/);
    await user.clear(mean);
    await user.type(mean, "0");
    expect(screen.getByRole("alert")).toHaveTextContent(de.formErrors.mu);
    expect(screen.getByRole("button", { name: de.settings.calculate })).toBeDisabled();
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when Vitest globals are on, and they are
// not. Without this, every render stacks up and queries find duplicates.
afterEach(cleanup);

// jsdom doesn't implement matchMedia; useTheme relies on it to read
// prefers-color-scheme.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

import "@testing-library/jest-dom/vitest";

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub;

// jsdom does not implement scrolling.
window.scrollTo = (() => {}) as typeof window.scrollTo;

// Vitest setup file for the client suite (jsdom environment).
//
// `vite.config.ts` runs the client tests under the `jsdom` environment and
// loads this file through `setupFiles`. Several libraries used by the app
// (notably `@hello-pangea/dnd`) read globals that jsdom does not implement,
// which would otherwise surface as `console.error` calls during render and
// break tests that assert on a clean console. This file provides minimal,
// test-only shims for those globals.

// `ResizeObserver` is consumed by @hello-pangea/dnd / virtualised auto-sizers.
// jsdom does not ship it.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof globalThis.ResizeObserver;

// jsdom does not implement requestAnimationFrame / cancelAnimationFrame,
// which @hello-pangea/dnd uses for its drag lifecycle.
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number =>
  setTimeout(() => cb(Date.now()), 0) as unknown as number;
globalThis.cancelAnimationFrame = (id: number): void => clearTimeout(id);

// jsdom does not implement Window.matchMedia.
const matchMediaImpl = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
if (!globalThis.matchMedia) {
  globalThis.matchMedia = matchMediaImpl as typeof window.matchMedia;
}

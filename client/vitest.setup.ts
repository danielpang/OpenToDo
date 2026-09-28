// Vitest setup file for the client suite (jsdom environment).
//
// The placeholder and theme-token tests assert with plain `vitest` matchers, so
// no extra matcher library is required here. This file exists so later leaves
// that need global DOM shims (e.g. ResizeObserver for @hello-pangea/dnd) have a
// single, well-known place to add them.
export {};

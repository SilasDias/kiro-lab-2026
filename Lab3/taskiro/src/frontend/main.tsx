/**
 * main.tsx — the React entry point for the TasKiro front end.
 *
 * The Bun Fullstack Dev Server bundles this module (referenced by
 * `src/index.html` as `<script type="module" src="./frontend/main.tsx">`),
 * transpiling the TSX and wiring it to the `#root` element (Requirement 13.1).
 *
 * `globals.css` is already imported by `index.html` via a `<link>` tag and
 * compiled locally by `bun-plugin-tailwind` (Requirements 15.1–15.4), so it is
 * not re-imported here.
 *
 * Rendering is wrapped in `React.StrictMode`; the application providers
 * (`AuthProvider` / `DataProvider`) and the full shell live in `App`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  // A missing root means the HTML shell failed to load; surface it loudly
  // rather than silently rendering nothing.
  throw new Error('Elemento raiz "#root" não encontrado em index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

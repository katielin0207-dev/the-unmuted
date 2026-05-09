import { Buffer } from "buffer";
// @ts-expect-error — polyfill for @solana/web3.js in browser
window.Buffer = Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

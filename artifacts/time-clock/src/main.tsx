import { createRoot } from "react-dom/client";
import App, { type RuntimeConfig } from "./App";
import "./index.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function bootstrap() {
  let runtimeConfig: RuntimeConfig = {};
  try {
    const res = await fetch(`${basePath}/api/config`);
    if (res.ok) {
      runtimeConfig = await res.json();
    }
  } catch {
    // Fall back to baked-in env vars (development, or API unreachable)
  }

  createRoot(document.getElementById("root")!).render(
    <App runtimeConfig={runtimeConfig} />,
  );
}

bootstrap();

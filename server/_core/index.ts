import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cron from "node-cron";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { fetchTreasuryData } from "../treasury";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // ── Daily scheduled cache refresh ──────────────────────────────────────────
  // TSE closes at 15:30 JST = 06:30 UTC.
  // Run at 06:30 UTC every weekday (Mon–Fri) to capture same-day disclosures.
  // Also run at 06:30 UTC on weekends to catch any late filings.
  cron.schedule("0 30 6 * * *", async () => {
    console.log("[cron] Daily refresh triggered at UTC 06:30 (JST 15:30)");
    try {
      await fetchTreasuryData(true); // force = bypass cache
      console.log("[cron] Daily refresh complete");
    } catch (e) {
      console.error("[cron] Daily refresh failed:", (e as Error).message);
    }
  });
}

startServer().catch(console.error);

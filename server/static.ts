import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("/{*path}", (req, res) => {
    const htmlPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(htmlPath, "utf-8");
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const baseUrl = `${protocol}://${host}`;
    html = html.replace(/content="(\/og-image[^""]*)"/g, `content="${baseUrl}$1"`);
    res.status(200).set({
      "Content-Type": "text/html",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    }).end(html);
  });
}

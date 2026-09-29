import express from "express";
import serverless from "serverless-http";

import { app } from "../../src/index";

/**
 * Netlify keeps the public API under /api while the same Express app continues
 * to run at the root path during local development and automated tests.
 */
export const netlifyApp = express();
netlifyApp.use("/api", app);

export const handler = serverless(netlifyApp);


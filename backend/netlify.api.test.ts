import request from "supertest";

import { netlifyApp } from "./netlify/functions/api";

describe("Netlify API adapter", () => {
  test("serves the existing health endpoint under the public /api path", async () => {
    const response = await request(netlifyApp).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", message: "Nouri API is running" });
  });
});


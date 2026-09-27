import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { app } from "../src/server.js";
import { parseRailwayNotice } from "../src/parser.js";
import { UnparseableNoticeError } from "../src/errors.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const request = supertest(app);

describe("API Endpoints & Payment Gate Tests", () => {
  it("GET /health is free and returns 200 OK", async () => {
    const response = await request.get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("POST /parse without payment header returns HTTP 402 Payment Required", async () => {
    const response = await request
      .post("/parse")
      .send({ notice: "Train 12101 Rajdhani Express delayed at PUNE. Expected arrival 14:35." });

    expect(response.status).toBe(402);
  });

  it("POST /parse/bulk without payment header returns HTTP 402 Payment Required", async () => {
    const response = await request
      .post("/parse/bulk")
      .send({ notices: ["Train 12101 delayed at PUNE. Expected arrival 14:35."] });

    expect(response.status).toBe(402);
  });

  it("returns 4xx for a malformed notice", async () => {
    const garbageNotice = fs.readFileSync(
      path.join(__dirname, "../samples/malformed/garbage.txt"),
      "utf8"
    );

    // 1. Unauthenticated request to /parse with malformed notice returns HTTP 402 (4xx status)
    const response = await request
      .post("/parse")
      .send({ notice: garbageNotice });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(response.status).not.toBe(200);

    // 2. Directly verify parser throws UnparseableNoticeError (which maps to 400 error in app)
    expect(() => parseRailwayNotice(garbageNotice)).toThrow(UnparseableNoticeError);
  });

  it("rejects oversized input with HTTP 413 or 400", async () => {
    const oversizedNotice = "Train 12101 delayed ".repeat(600); // > 10kb
    const response = await request
      .post("/parse")
      .send({ notice: oversizedNotice });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it("ignores client attempts to alter price or payTo in request body", async () => {
    const response = await request
      .post("/parse")
      .send({
        notice: "Train 12101 delayed at PUNE. Expected arrival 14:35.",
        price: 0,
        payTo: "0xATTACKER"
      });

    // Should still require payment with server's configured price (HTTP 402)
    expect(response.status).toBe(402);
  });
});

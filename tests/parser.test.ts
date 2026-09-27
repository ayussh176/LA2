import { describe, it, expect } from "vitest";
import { parseRailwayNotice } from "../src/parser.js";
import { UnparseableNoticeError } from "../src/errors.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Railway Delay Notice Parser", () => {
  it("parses valid English notice with reason", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/valid/english-01.txt"), "utf8");
    const result = parseRailwayNotice(text);

    expect(result.train.number).toBe("12101");
    expect(result.train.name).toBe("Rajdhani Express");
    expect(result.station).toBe("PUNE");
    expect(result.expectedTime).toBe("14:35");
    expect(result.reason).toBe("heavy rain");
  });

  it("parses valid English notice without reason", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/valid/english-02.txt"), "utf8");
    const result = parseRailwayNotice(text);

    expect(result.train.number).toBe("11010");
    expect(result.train.name).toBe("Express");
    expect(result.station).toBe("NGP");
    expect(result.expectedTime).toBe("18:20");
    expect(result.reason).toBeUndefined();
  });

  it("parses valid Hindi notice", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/valid/hindi-01.txt"), "utf8");
    const result = parseRailwayNotice(text);

    expect(result.train.number).toBe("12101");
    expect(result.station).toBe("PUNE");
    expect(result.expectedTime).toBe("14:35");
    expect(result.reason).toBeDefined();
  });

  it("parses valid Marathi notice", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/valid/marathi-01.txt"), "utf8");
    const result = parseRailwayNotice(text);

    expect(result.train.number).toBe("12101");
    expect(result.station).toBe("PUNE");
    expect(result.expectedTime).toBe("14:35");
    expect(result.reason).toBeDefined();
  });

  it("throws UnparseableNoticeError for missing train number", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/malformed/missing-train.txt"), "utf8");
    expect(() => parseRailwayNotice(text)).toThrow(UnparseableNoticeError);
  });

  it("throws UnparseableNoticeError for missing station code", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/malformed/missing-station.txt"), "utf8");
    expect(() => parseRailwayNotice(text)).toThrow(UnparseableNoticeError);
  });

  it("throws UnparseableNoticeError for invalid time", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/malformed/invalid-time.txt"), "utf8");
    expect(() => parseRailwayNotice(text)).toThrow(UnparseableNoticeError);
  });

  it("throws UnparseableNoticeError for complete garbage input", () => {
    const text = fs.readFileSync(path.join(__dirname, "../samples/malformed/garbage.txt"), "utf8");
    expect(() => parseRailwayNotice(text)).toThrow(UnparseableNoticeError);
  });
});

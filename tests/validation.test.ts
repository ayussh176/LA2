import { describe, it, expect } from "vitest";
import {
  ParsedNoticeSchema,
  ParseNoticeInputSchema,
  BulkParseInputSchema
} from "../src/schemas.js";

describe("Zod Validation Schemas", () => {
  it("validates valid ParsedNotice data structure", () => {
    const validData = {
      train: { number: "12101", name: "Rajdhani Express" },
      station: "PUNE",
      expectedTime: "14:35",
      reason: "heavy rain"
    };
    expect(() => ParsedNoticeSchema.parse(validData)).not.toThrow();
  });

  it("fails validation if train number contains letters", () => {
    const invalidData = {
      train: { number: "12101A" },
      station: "PUNE",
      expectedTime: "14:35"
    };
    expect(() => ParsedNoticeSchema.parse(invalidData)).toThrow();
  });

  it("fails validation if station code is too short", () => {
    const invalidData = {
      train: { number: "12101" },
      station: "P",
      expectedTime: "14:35"
    };
    expect(() => ParsedNoticeSchema.parse(invalidData)).toThrow();
  });

  it("fails validation if time format is not HH:MM", () => {
    const invalidData = {
      train: { number: "12101" },
      station: "PUNE",
      expectedTime: "2:35 PM"
    };
    expect(() => ParsedNoticeSchema.parse(invalidData)).toThrow();
  });

  it("validates ParseNoticeInputSchema", () => {
    expect(() => ParseNoticeInputSchema.parse({ notice: "Valid notice" })).not.toThrow();
    expect(() => ParseNoticeInputSchema.parse({ notice: "" })).toThrow();
    expect(() => ParseNoticeInputSchema.parse({ notice: "a".repeat(2001) })).toThrow();
  });

  it("validates BulkParseInputSchema", () => {
    expect(() => BulkParseInputSchema.parse({ notices: ["Notice 1", "Notice 2"] })).not.toThrow();
    expect(() => BulkParseInputSchema.parse({ notices: [] })).toThrow();
    expect(() => BulkParseInputSchema.parse({ notices: Array(51).fill("Notice") })).toThrow();
  });
});

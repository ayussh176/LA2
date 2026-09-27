import { z } from "zod";

export const MAX_NOTICE_LENGTH = 2000;
export const MAX_BULK_COUNT = 50;

export const ParsedNoticeSchema = z.object({
  train: z.object({
    number: z.string().regex(/^\d+$/, "Train number must consist only of digits"),
    name: z.string().optional()
  }),
  station: z.string().min(2, "Station code must be at least 2 characters"),
  expectedTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected time must be in HH:MM format"),
  reason: z.string().optional()
});

export const ParseNoticeInputSchema = z.object({
  notice: z
    .string()
    .min(1, "Notice text is required")
    .max(MAX_NOTICE_LENGTH, `Notice exceeds maximum length of ${MAX_NOTICE_LENGTH} characters`)
});

export const BulkParseInputSchema = z.object({
  notices: z
    .array(
      z
        .string()
        .min(1, "Notice cannot be empty")
        .max(MAX_NOTICE_LENGTH, `Notice exceeds maximum length of ${MAX_NOTICE_LENGTH} characters`)
    )
    .min(1, "At least one notice must be provided")
    .max(MAX_BULK_COUNT, `Bulk parse accepts at most ${MAX_BULK_COUNT} notices`)
});

export type ParsedNoticeType = z.infer<typeof ParsedNoticeSchema>;

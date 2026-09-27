import { ParsedNotice, TrainInfo } from "./types.js";
import { UnparseableNoticeError } from "./errors.js";

/**
 * Deterministic parser for railway delay notices in English, Hindi, and Marathi.
 * Extracts: train number & name, station code, expected arrival time, and optional reason.
 */
export function parseRailwayNotice(noticeText: string): ParsedNotice {
  if (!noticeText || typeof noticeText !== "string" || noticeText.trim().length === 0) {
    throw new UnparseableNoticeError("Notice text is empty or missing.");
  }

  const raw = noticeText.trim();

  // 1. Extract Train Details
  const trainInfo = parseTrainDetails(raw);
  if (!trainInfo || !trainInfo.number) {
    throw new UnparseableNoticeError("Could not extract valid train number from notice.");
  }

  // 2. Extract Station Identifier
  const station = parseStationCode(raw);
  if (!station) {
    throw new UnparseableNoticeError("Could not extract station identifier from notice.");
  }

  // 3. Extract Scheduled/Expected Arrival Time
  const expectedTime = parseExpectedArrivalTime(raw);
  if (!expectedTime) {
    throw new UnparseableNoticeError("Could not extract valid expected arrival time from notice.");
  }

  // 4. Extract Optional Delay Reason
  const reason = parseDelayReason(raw);

  const parsed: ParsedNotice = {
    train: trainInfo,
    station,
    expectedTime
  };

  if (reason) {
    parsed.reason = reason;
  }

  return parsed;
}

function parseTrainDetails(text: string): TrainInfo | null {
  // Regex to detect 4 to 5 digit train numbers across English, Hindi, and Marathi headers
  const trainPatterns = [
    /(?:Train\s*(?:No\.?|Num\.?|Number)?|गाड़ी\s*(?:संख्या|नं\.?)?|गाडी\s*(?:क्रमांक|क्र\.?)?|ट्रेन)\s*(\d{4,5})/i,
    /\b(\d{4,5})\b/
  ];

  let trainNumber: string | null = null;
  for (const pattern of trainPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      trainNumber = match[1];
      break;
    }
  }

  if (!trainNumber) {
    return null;
  }

  // Look for train name immediately following the train number
  let trainName: string | undefined = undefined;

  const trainNamePattern = new RegExp(
    `(?:Train\\s*(?:No\\.?|Num\\.?)?|गाड़ी\\s*(?:संख्या)?|गाडी\\s*(?:क्रमांक|क्र\\.?)?|ट्रेन)?\\s*${trainNumber}\\s+([A-Za-z\\s]+?)(?=\\s+(?:delayed|at|is|running|will|विलंबित|उशिरा|स्टेशन|स्थानक|बजे|वाजता|due|because|\\.|,|$))`,
    "i"
  );

  const nameMatch = text.match(trainNamePattern);
  if (nameMatch && nameMatch[1]) {
    const candidate = nameMatch[1].trim();
    const commonStopWords = new Set(["delayed", "at", "is", "running", "on", "will"]);
    if (candidate && !commonStopWords.has(candidate.toLowerCase())) {
      trainName = candidate;
    }
  }

  return {
    number: trainNumber,
    ...(trainName ? { name: trainName } : {})
  };
}

function parseStationCode(text: string): string | null {
  // 1. Look for station code after station indicator tokens (e.g. at PUNE, station NGP, स्थानक PUNE, स्टेशन PUNE)
  const contextRegex = /(?:at|station|स्टेशन|स्थानक|पर|येथे)\s+([A-Z]{2,5})\b/i;
  const contextMatch = text.match(contextRegex);
  if (contextMatch && contextMatch[1]) {
    return contextMatch[1].toUpperCase();
  }

  // 2. Known Indian Railways major station codes
  const majorStations = new Set([
    "PUNE", "NGP", "CSMT", "NDLS", "HWH", "MAS", "SBC",
    "ADI", "BCT", "PNVL", "HYB", "MYS", "BJU", "LKO", "MMCT", "GHY"
  ]);

  const tokens = text.split(/[\s,.]+/);
  for (const token of tokens) {
    const cleaned = token.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (majorStations.has(cleaned)) {
      return cleaned;
    }
  }

  // 3. Fallback: uppercase 2-5 letter word that isn't a reserved keyword
  const ignoredKeywords = new Set(["TRAIN", "NO", "NUM", "EXPRESS", "MAIL", "SUPERFAST", "SPECIAL"]);
  for (const token of tokens) {
    const cleaned = token.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (
      token === token.toUpperCase() &&
      cleaned.length >= 2 &&
      cleaned.length <= 5 &&
      !ignoredKeywords.has(cleaned) &&
      /^[A-Z]+$/.test(cleaned)
    ) {
      return cleaned;
    }
  }

  return null;
}

function parseExpectedArrivalTime(text: string): string | null {
  // HH:MM or HH.MM in 24-hour format (e.g. 14:35, 18:20, 09:15)
  const timeRegexes = [
    /\b([0-1]?[0-9]|2[0-3])[:.]([0-5][0-9])\s*(?:hrs|hours|बजे|वाजता)?\b/i,
    /(?:expected|arrival|समय|वेळ)\s*([0-1]?[0-9]|2[0-3])[:.\s]?([0-5][0-9])/i,
    /\b([0-1]?[0-9]|2[0-3])\s+([0-5][0-9])\s*(?:hrs|hours|बजे|वाजता)\b/i
  ];

  for (const regex of timeRegexes) {
    const match = text.match(regex);
    if (match && match[1] && match[2]) {
      const hours = match[1].padStart(2, "0");
      const minutes = match[2].padStart(2, "0");
      return `${hours}:${minutes}`;
    }
  }

  return null;
}

function parseDelayReason(text: string): string | undefined {
  // English reason phrases: "due to ...", "because of ..."
  const englishReason = text.match(/(?:due to|because of|owing to)\s+([^.,;\n]+)/i);
  if (englishReason && englishReason[1]) {
    return englishReason[1].trim();
  }

  // Hindi reason phrases: "... के कारण"
  const hindiReason = text.match(/(.+?)\s*के कारण/);
  if (hindiReason && hindiReason[1]) {
    const cleaned = hindiReason[1].replace(/.*(?:गाड़ी|ट्रेन|स्टेशन|बजे|\d+)\s*/, "").trim();
    if (cleaned) {
      return cleaned;
    }
  }

  // Marathi reason phrases: "... मुळे" / "... कारणास्तव"
  const marathiReason = text.match(/(.+?)\s*(?:मुळे|कारणास्तव)/);
  if (marathiReason && marathiReason[1]) {
    const cleaned = marathiReason[1].replace(/.*(?:गाडी|ट्रेन|स्टेशन|स्थानक|वाजता|\d+)\s*/, "").trim();
    if (cleaned) {
      return cleaned;
    }
  }

  return undefined;
}

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme as ClientExactScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { config, buyerConfig } from "./config.js";
import { parseRailwayNotice } from "./parser.js";
import {
  ParseNoticeInputSchema,
  BulkParseInputSchema,
  ParsedNoticeSchema
} from "./schemas.js";
import { AppError } from "./errors.js";
import { ParsedNotice } from "./types.js";

export const app = express();

app.use(cors());

// Strict body size limit of 10kb
app.use(express.json({ limit: "10kb" }));

// Security middleware: Ensure client request body does NOT override server-controlled payment params
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    delete req.body.price;
    delete req.body.payTo;
    delete req.body.network;
    delete req.body.facilitator;
  }
  next();
});

// Serve static frontend dashboard assets
app.use(express.static("public"));

// --- FREE ENDPOINTS ---
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/api/config", (req: Request, res: Response) => {
  res.json({
    network: config.x402Network,
    payTo: config.x402PayTo,
    parsePrice: config.parsePrice,
    bulkPrice: config.bulkPrice,
    facilitatorUrl: config.facilitatorUrl,
    hasBuyerKey: Boolean(buyerConfig.buyerPrivateKey)
  });
});

// Demo Endpoint: Single Notice Parse via x402 Buyer Client
app.post("/api/demo-buy", async (req: Request, res: Response) => {
  try {
    const { notice } = req.body;
    if (!notice) {
      res.status(400).json({ error: "Notice text is required" });
      return;
    }

    const privateKey = buyerConfig.buyerPrivateKey;
    if (!privateKey) {
      res.status(500).json({
        error: "NO_BUYER_KEY",
        message: "BUYER_PRIVATE_KEY is not configured in .env"
      });
      return;
    }

    const formattedPrivateKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedPrivateKey);
    const evmSigner = toClientEvmSigner(account);
    const client = new x402Client();
    client.register(config.x402Network as any, new ClientExactScheme(evmSigner));

    const fetchWithPayment = wrapFetchWithPayment(fetch, client);

    const response = await fetchWithPayment(`http://localhost:${config.port}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notice })
    });

    const data = await response.json();
    res.json({
      status: response.status,
      buyerAddress: account.address,
      data
    });
  } catch (error: any) {
    res.status(500).json({
      error: "DEMO_BUY_FAILED",
      message: error.message || String(error)
    });
  }
});

// Demo Endpoint: Bulk Notice Parse via x402 Buyer Client
app.post("/api/demo-buy-bulk", async (req: Request, res: Response) => {
  try {
    const { notices } = req.body;
    if (!notices || !Array.isArray(notices)) {
      res.status(400).json({ error: "Array of notices is required" });
      return;
    }

    const privateKey = buyerConfig.buyerPrivateKey;
    if (!privateKey) {
      res.status(500).json({
        error: "NO_BUYER_KEY",
        message: "BUYER_PRIVATE_KEY is not configured in .env"
      });
      return;
    }

    const formattedPrivateKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedPrivateKey);
    const evmSigner = toClientEvmSigner(account);
    const client = new x402Client();
    client.register(config.x402Network as any, new ClientExactScheme(evmSigner));

    const fetchWithPayment = wrapFetchWithPayment(fetch, client);

    const response = await fetchWithPayment(`http://localhost:${config.port}/parse/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notices })
    });

    const data = await response.json();
    res.json({
      status: response.status,
      buyerAddress: account.address,
      data
    });
  } catch (error: any) {
    res.status(500).json({
      error: "DEMO_BUY_FAILED",
      message: error.message || String(error)
    });
  }
});

// --- SERVER-CONTROLLED X402 PAYMENT CONFIGURATION ---
const facilitatorClient = new HTTPFacilitatorClient({
  url: config.facilitatorUrl
});

const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(config.x402Network as any, new ExactEvmScheme());

const routesConfig = {
  "POST /parse": {
    accepts: {
      scheme: "exact",
      payTo: config.x402PayTo,
      price: config.parsePrice,
      network: config.x402Network as any
    },
    description: "Parse a single railway delay notice"
  },
  "POST /parse/bulk": {
    accepts: {
      scheme: "exact",
      payTo: config.x402PayTo,
      price: config.bulkPrice,
      network: config.x402Network as any
    },
    description: "Parse multiple railway delay notices in bulk"
  }
};

// Mount x402 payment middleware for paid routes
app.use(paymentMiddleware(routesConfig as any, resourceServer, undefined, undefined, true));

// --- PAID ENDPOINT 1: POST /parse ---
app.post("/parse", (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Input Zod validation
    const inputResult = ParseNoticeInputSchema.safeParse(req.body);
    if (!inputResult.success) {
      res.status(400).json({
        error: "INVALID_INPUT",
        message: inputResult.error.issues.map((e: any) => e.message).join("; ")
      });
      return;
    }

    // 2. Application Notice Parsing
    const parsedData = parseRailwayNotice(inputResult.data.notice);

    // 3. Output Zod Validation
    const validatedResult = ParsedNoticeSchema.parse(parsedData);

    // 4. Return successful 200 JSON -> x402 middleware settles payment
    res.json(validatedResult);
  } catch (err: any) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.errorCode,
        message: err.message
      });
      return;
    }
    next(err);
  }
});

// --- PAID ENDPOINT 2: POST /parse/bulk ---
app.post("/parse/bulk", (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Input Zod validation
    const inputResult = BulkParseInputSchema.safeParse(req.body);
    if (!inputResult.success) {
      res.status(400).json({
        error: "INVALID_INPUT",
        message: inputResult.error.issues.map((e: any) => e.message).join("; ")
      });
      return;
    }

    const results: ParsedNotice[] = [];

    // 2. Parse each notice in the bulk request
    for (const noticeText of inputResult.data.notices) {
      const parsedData = parseRailwayNotice(noticeText);
      const validatedResult = ParsedNoticeSchema.parse(parsedData);
      results.push(validatedResult);
    }

    // 3. Return successful 200 JSON -> x402 middleware settles payment
    res.json({ results });
  } catch (err: any) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.errorCode,
        message: err.message
      });
      return;
    }
    next(err);
  }
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === "entity.too.large") {
    res.status(413).json({
      error: "PAYLOAD_TOO_LARGE",
      message: "Request payload exceeds size limit of 10kb."
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.errorCode,
      message: err.message
    });
    return;
  }

  console.error("Unhandled Server Error:", err);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred."
  });
});

export function startServer(port: number = config.port) {
  return app.listen(port, () => {
    console.log(`The Operator's Booth API listening on port ${port}`);
    console.log(`Network: ${config.x402Network}`);
    console.log(`PayTo: ${config.x402PayTo}`);
    console.log(`Parse price: $${config.parsePrice}, Bulk price: $${config.bulkPrice}`);
  });
}

// Start if executed directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js")
) {
  startServer();
}

import dotenv from "dotenv";
import { ServerConfig, BuyerConfig } from "./types.js";

dotenv.config();

const network = process.env.X402_NETWORK || "eip155:84532";

// STRICT TESTNET ENFORCEMENT: Only Base Sepolia (eip155:84532) testnet allowed.
if (network === "eip155:8453" || network.toLowerCase().includes("mainnet")) {
  throw new Error(
    `SECURITY CONFIGURATION ERROR: Mainnet identifier '${network}' is prohibited. Only testnet (eip155:84532) is permitted.`
  );
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  x402Network: network,
  x402PayTo: process.env.X402_PAY_TO || "0x0000000000000000000000000000000000000000",
  parsePrice: process.env.X402_PARSE_PRICE || "0.001",
  bulkPrice: process.env.X402_BULK_PRICE || "0.005",
  facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator"
};

export const buyerConfig: BuyerConfig = {
  buyerPrivateKey: process.env.BUYER_PRIVATE_KEY || "",
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${config.port}`
};

import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

dotenv.config();

async function main() {
  const privateKey = process.env.BUYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: BUYER_PRIVATE_KEY environment variable is required.");
    console.error("Please set BUYER_PRIVATE_KEY in your .env file or environment.");
    process.exit(1);
  }

  const formattedPrivateKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedPrivateKey);
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  console.log("=== x402 Bulk Buyer Client ===");
  console.log(`Buyer Wallet Address: ${account.address}`);
  console.log(`Target API URL: ${baseUrl}/parse/bulk`);

  // Initialize x402 EVM client for Base Sepolia (eip155:84532)
  const evmSigner = toClientEvmSigner(account);
  const client = new x402Client();
  client.register("eip155:84532", new ExactEvmScheme(evmSigner));

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const sampleNotices = [
    "Train 12101 Rajdhani Express delayed at PUNE. Expected arrival 14:35 due to heavy rain.",
    "Train 11010 Express delayed at NGP. Expected arrival 18:20."
  ];

  console.log(`\nSending POST /parse/bulk with ${sampleNotices.length} notices...\n`);

  try {
    const response = await fetchWithPayment(`${baseUrl}/parse/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ notices: sampleNotices })
    });

    console.log(`Response HTTP Status: ${response.status}`);

    const data = await response.json();
    console.log("\nStructured Bulk Result JSON:");
    console.log(JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.error("Bulk Payment or Request Failed:", error.message || error);
    process.exit(1);
  }
}

main();

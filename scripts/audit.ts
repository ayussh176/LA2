import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { config } from "../src/config.js";
import { parseRailwayNotice } from "../src/parser.js";
import { UnparseableNoticeError } from "../src/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAudit() {
  console.log("========================================");
  console.log("OPERATOR'S BOOTH ACCEPTANCE AUDIT");
  console.log("========================================\n");

  const projectRoot = path.resolve(__dirname, "..");
  const results: Record<string, boolean> = {};

  // 1. x402 route
  const serverCode = fs.readFileSync(path.join(projectRoot, "src/server.ts"), "utf8");
  results["1. x402 route"] = serverCode.includes("paymentMiddleware") && serverCode.includes("x402ResourceServer");

  // 2. testnet configuration
  results["2. testnet configuration"] = config.x402Network === "eip155:84532" && !serverCode.includes("eip155:8453'");

  // 3. x402 buyer
  const buyerCode = fs.readFileSync(path.join(projectRoot, "buyer/buy.ts"), "utf8");
  results["3. x402 buyer"] = buyerCode.includes("wrapFetchWithPayment") && buyerCode.includes("x402Client");

  // 4. no credentials
  const envExample = fs.readFileSync(path.join(projectRoot, ".env.example"), "utf8");
  const gitIgnore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
  results["4. no credentials"] = gitIgnore.includes(".env") && envExample.includes("0xYOUR_BUYER_PRIVATE_KEY");

  // 5. server-side price
  results["5. server-side price"] = serverCode.includes("price: config.parsePrice") && serverCode.includes("delete req.body.price");

  // 6. server-side payTo
  results["6. server-side payTo"] = serverCode.includes("payTo: config.x402PayTo") && serverCode.includes("delete req.body.payTo");

  // 7. malformed -> 4xx
  let malformedHandled = false;
  try {
    parseRailwayNotice("This is completely unrelated garbage.");
  } catch (e) {
    if (e instanceof UnparseableNoticeError && e.statusCode >= 400) {
      malformedHandled = true;
    }
  }
  results["7. malformed -> 4xx"] = malformedHandled;

  // 8. input size cap
  const schemaCode = fs.readFileSync(path.join(projectRoot, "src/schemas.ts"), "utf8");
  results["8. input size cap"] = serverCode.includes('express.json({ limit: "10kb" })') && schemaCode.includes("MAX_NOTICE_LENGTH = 2000");

  // 9. Zod output validation
  results["9. Zod output validation"] = serverCode.includes("ParsedNoticeSchema.parse");

  // 10. malformed automated test
  const apiTestCode = fs.readFileSync(path.join(projectRoot, "tests/api.test.ts"), "utf8");
  results["10. malformed automated test"] = apiTestCode.includes('returns 4xx for a malformed notice') && apiTestCode.includes("toBeGreaterThanOrEqual(400)");

  // Run typecheck
  let typecheckPassed = false;
  try {
    execSync("npm run typecheck", { cwd: projectRoot, stdio: "pipe" });
    typecheckPassed = true;
  } catch {}

  // Run tests
  let testsPassed = false;
  try {
    execSync("npm test", { cwd: projectRoot, stdio: "pipe" });
    testsPassed = true;
  } catch {}

  // Run build
  let buildPassed = false;
  try {
    execSync("npm run build", { cwd: projectRoot, stdio: "pipe" });
    buildPassed = true;
  } catch {}

  // Print results
  for (const [key, pass] of Object.entries(results)) {
    console.log(`${key.padEnd(30)} ${pass ? "PASS" : "FAIL"}`);
  }

  console.log(`\nBuild: ${buildPassed ? "PASS" : "FAIL"}`);
  console.log(`Typecheck: ${typecheckPassed ? "PASS" : "FAIL"}`);
  console.log(`Tests: ${testsPassed ? "PASS" : "FAIL"}`);
  console.log("========================================");

  const allPassed = Object.values(results).every(Boolean) && buildPassed && typecheckPassed && testsPassed;
  if (!allPassed) {
    process.exit(1);
  }
}

runAudit();

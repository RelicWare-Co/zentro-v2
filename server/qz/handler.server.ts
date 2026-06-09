import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "@/server/auth";

/**
 * QZ Tray server-side signing.
 *
 * QZ Tray asks the browser to prove each print request is authorized. The
 * browser receives a short SHA-256 hash (the `toSign` string) and must return
 * an RSA-SHA512 signature of it produced with the private key that pairs with
 * the certificate trusted by QZ Tray. Doing this server-side keeps the private
 * key off the client and removes the "allow this request" popup.
 *
 * Configure via environment variables (file path or inline PEM):
 *   QZ_CERTIFICATE_PATH / QZ_CERTIFICATE          → digital-certificate.txt
 *   QZ_PRIVATE_KEY_PATH / QZ_PRIVATE_KEY          → private-key.pem (PKCS#8)
 *   QZ_PRIVATE_KEY_PASSPHRASE                     → optional key passphrase
 *
 * When the certificate/key are not configured the endpoints respond with a
 * non-200 status so the client gracefully falls back to QZ's unsigned mode
 * (which still prints, but shows the allow popup).
 *
 * SECURITY: the /sign route is a signing oracle. It is gated behind a valid
 * authenticated session so anonymous callers cannot have arbitrary requests
 * signed with our key.
 */

const signQuerySchema = z.object({
  request: z.string().trim().min(1).max(8192),
});

function getRuntimeEnv() {
  const bun = (globalThis as { Bun?: { env: NodeJS.ProcessEnv } }).Bun;
  return bun?.env ?? process.env;
}

let cachedCertificate: string | null | undefined;
let cachedPrivateKey: string | null | undefined;

async function readPemSource(
  inlineValue: string | undefined,
  pathValue: string | undefined
): Promise<string | null> {
  const inline = inlineValue?.trim();
  if (inline) {
    return inline;
  }

  const filePath = pathValue?.trim();
  if (!filePath) {
    return null;
  }

  try {
    const contents = await readFile(filePath, "utf8");
    const trimmed = contents.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

async function loadCertificate(): Promise<string | null> {
  if (cachedCertificate !== undefined) {
    return cachedCertificate;
  }

  const env = getRuntimeEnv();
  cachedCertificate = await readPemSource(
    env.QZ_CERTIFICATE,
    env.QZ_CERTIFICATE_PATH
  );
  return cachedCertificate;
}

async function loadPrivateKey(): Promise<string | null> {
  if (cachedPrivateKey !== undefined) {
    return cachedPrivateKey;
  }

  const env = getRuntimeEnv();
  cachedPrivateKey = await readPemSource(
    env.QZ_PRIVATE_KEY,
    env.QZ_PRIVATE_KEY_PATH
  );
  return cachedPrivateKey;
}

function getPassphrase(): string | undefined {
  const passphrase = getRuntimeEnv().QZ_PRIVATE_KEY_PASSPHRASE?.trim();
  return passphrase && passphrase.length > 0 ? passphrase : undefined;
}

function signRequest(
  toSign: string,
  privateKey: string,
  passphrase: string | undefined
): string {
  const signer = createSign("RSA-SHA512");
  signer.update(toSign);
  signer.end();
  return signer.sign(
    passphrase ? { key: privateKey, passphrase } : privateKey,
    "base64"
  );
}

async function hasValidSession(headers: Headers): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers });
    return Boolean(session?.user);
  } catch {
    return false;
  }
}

const PLAIN_TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

export function createQzApp() {
  const app = new Hono<EvlogVariables>();

  // Served to the browser on page load via qz.security.setCertificatePromise.
  // The certificate is public, so this route does not require a session.
  app.get("/certificate", async (c) => {
    const certificate = await loadCertificate();
    if (!certificate) {
      // Not configured → client falls back to QZ unsigned mode.
      return c.text("QZ certificate not configured", 404);
    }
    return c.text(certificate, 200, PLAIN_TEXT_HEADERS);
  });

  // Signing oracle. Requires an authenticated session.
  app.get("/sign", async (c) => {
    if (!(await hasValidSession(c.req.raw.headers))) {
      return c.text("Unauthorized", 401);
    }

    const parsed = signQuerySchema.safeParse({
      request: c.req.query("request") ?? "",
    });
    if (!parsed.success) {
      return c.text("Invalid request", 400);
    }

    const privateKey = await loadPrivateKey();
    if (!privateKey) {
      // Not configured → client falls back to QZ unsigned mode.
      return c.text("QZ signing not configured", 503);
    }

    const signature = signRequest(
      parsed.data.request,
      privateKey,
      getPassphrase()
    );
    return c.text(signature, 200, PLAIN_TEXT_HEADERS);
  });

  return app;
}

import { describe, expect, test } from "bun:test";
import { createSign, generateKeyPairSync } from "node:crypto";
import { isPrivateKeyPem, normalizePemSource } from "@/server/qz/pem.server";

function signWithKey(privateKey: string) {
  const signer = createSign("RSA-SHA512");
  signer.update("qz-test-request");
  signer.end();
  return signer.sign(privateKey, "base64");
}

describe("QZ Tray PEM normalization", () => {
  test("converts inline escaped newlines into a signable private key", () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: {
        format: "pem",
        type: "pkcs8",
      },
      publicKeyEncoding: {
        format: "pem",
        type: "spki",
      },
    });
    const inlineValue = privateKey.trim().replace(/\r?\n/g, "\\n");
    const normalized = normalizePemSource(inlineValue);

    expect(normalized).toBeString();
    expect(normalized).toContain("\n");
    expect(normalized).not.toContain("\\n");
    expect(isPrivateKeyPem(normalized ?? "")).toBe(true);
    expect(signWithKey(normalized ?? "")).toBeString();
  });

  test("strips wrapping quotes commonly copied into deployment env UIs", () => {
    const normalized = normalizePemSource(
      '"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----"'
    );

    expect(normalized).toBe(
      "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
    );
  });

  test("rejects certificates where a private key is required", () => {
    expect(
      isPrivateKeyPem(
        "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----"
      )
    ).toBe(false);
  });
});

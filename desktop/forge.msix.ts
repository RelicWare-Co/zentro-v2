import { readFileSync } from "node:fs";
import path from "node:path";
import type { MakerMSIXConfig } from "@electron-forge/maker-msix";
import { MakerMSIX } from "@electron-forge/maker-msix";
import { config as loadEnv } from "dotenv";

const desktopRoot = import.meta.dirname;
const msixDir = path.join(desktopRoot, "msix");
const msixAssetsDir = path.join(msixDir, "assets");

loadEnv({ path: path.join(msixDir, ".env"), quiet: true });

const packageJson = JSON.parse(
  readFileSync(path.join(desktopRoot, "package.json"), "utf8")
) as { version: string; author?: { name?: string } };

const publisherFromAuthor = () => {
  const name = packageJson.author?.name?.trim();
  return name ? `CN=${name}` : "CN=Zentro Dev";
};

const resolveMsixManifestPath = (): string | undefined => {
  const fromEnv = process.env.ZENTRO_MSIX_APP_MANIFEST?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(desktopRoot, fromEnv);
  }
  const committed = path.join(msixDir, "Package.appxmanifest");
  try {
    readFileSync(committed, "utf8");
    return committed;
  } catch {
    return;
  }
};

export const createMsixMaker = (): MakerMSIX => {
  const signEnabled = process.env.ZENTRO_MSIX_SIGN === "true";
  const certFile = process.env.ZENTRO_MSIX_CERT_FILE?.trim();
  const certPassword = process.env.ZENTRO_MSIX_CERT_PASSWORD;

  const appManifest = resolveMsixManifestPath();

  const config: MakerMSIXConfig = {
    packageAssets: msixAssetsDir,
    sign: signEnabled,
    windowsKitVersion:
      process.env.ZENTRO_MSIX_WINDOWS_KIT_VERSION?.trim() ?? "10.0.26100.0",
    manifestVariables: {
      publisher:
        process.env.ZENTRO_MSIX_PUBLISHER?.trim() ?? publisherFromAuthor(),
      packageIdentity:
        process.env.ZENTRO_MSIX_PACKAGE_IDENTITY?.trim() ??
        "com.zentro.desktop",
      packageVersion: packageJson.version,
      appExecutable: "zentro.exe",
      packageDisplayName: "Zentro",
      appDisplayName: "Zentro",
      packageDescription: "Desktop wrapper for Zentro web app.",
      packageBackgroundColor: "#0a0a0a",
      packageMinOSVersion: "10.0.19041.0",
      packageMaxOSVersionTested: "10.0.22621.0",
      publisherDisplayName:
        process.env.ZENTRO_MSIX_PUBLISHER_DISPLAY_NAME?.trim() ??
        packageJson.author?.name ??
        "Zentro",
    },
  };

  if (appManifest) {
    config.appManifest = appManifest;
  }

  if (signEnabled && certFile) {
    config.windowsSignOptions = {
      certificateFile: certFile,
      ...(certPassword ? { certificatePassword: certPassword } : {}),
    };
  }

  if (process.env.DEBUG?.includes("electron-windows-msix")) {
    config.logLevel = "debug";
  }

  return new MakerMSIX(config);
};

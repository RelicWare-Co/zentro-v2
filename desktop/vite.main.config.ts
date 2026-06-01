import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const parseEnvFile = (filePath: string) => {
  if (!existsSync(filePath)) {
    return {};
  }

  const entries: Record<string, string> = {};

  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    entries[key] = value;
  }

  return entries;
};

const desktopEnv = parseEnvFile(path.join(process.cwd(), ".env"));
const webUrl =
  process.env.ZENTRO_DESKTOP_WEB_URL ?? desktopEnv.ZENTRO_DESKTOP_WEB_URL ?? "";

export default {
  define: {
    "import.meta.env.ZENTRO_DESKTOP_WEB_URL": JSON.stringify(webUrl.trim()),
  },
};

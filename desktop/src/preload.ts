import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("zentroDesktop", {
  isDesktop: true,
  platform: process.platform,
} as const);

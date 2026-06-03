import { contextBridge, ipcRenderer } from "electron";

import { type DesktopConnectionStatus, desktopIpc } from "./desktop-api";

const desktopApi = {
  getConnectionStatus: () =>
    ipcRenderer.invoke(
      desktopIpc.getConnectionStatus
    ) as Promise<DesktopConnectionStatus>,
  isDesktop: true,
  onConnectionStatus: (listener: (status: DesktopConnectionStatus) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      status: unknown
    ) => {
      listener(status as DesktopConnectionStatus);
    };

    ipcRenderer.on(desktopIpc.connectionStatus, subscription);

    return () => {
      ipcRenderer.removeListener(desktopIpc.connectionStatus, subscription);
    };
  },
  openDevTools: () =>
    ipcRenderer.invoke(desktopIpc.openDevTools) as Promise<void>,
  platform: process.platform,
  retryConnection: () =>
    ipcRenderer.invoke(desktopIpc.retryConnection) as Promise<void>,
} as const;

contextBridge.exposeInMainWorld("zentroDesktop", desktopApi);

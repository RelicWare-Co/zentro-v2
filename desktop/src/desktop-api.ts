export const desktopIpc = {
  connectionStatus: "zentro:connection-status",
  getConnectionStatus: "zentro:get-connection-status",
  retryConnection: "zentro:retry-connection",
} as const;

export type DesktopConnectionStatus =
  | {
      state: "checking";
      message: string;
      webAppUrl: string | null;
    }
  | {
      state: "offline";
      message: string;
      webAppUrl: string;
    }
  | {
      state: "configuration-error";
      message: string;
      webAppUrl: null;
    };

type ZentroDesktopConnectionStatus =
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

interface Window {
  readonly zentroDesktop?: {
    readonly getConnectionStatus: () => Promise<ZentroDesktopConnectionStatus>;
    readonly isDesktop: true;
    readonly onConnectionStatus: (
      listener: (status: ZentroDesktopConnectionStatus) => void
    ) => () => void;
    readonly platform: string;
    readonly retryConnection: () => Promise<void>;
  };
}

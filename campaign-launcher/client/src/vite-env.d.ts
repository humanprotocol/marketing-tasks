/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_APP_TERMS_URL?: string;
  readonly VITE_APP_PRIVACY_URL?: string;
  readonly VITE_APP_PUBLIC_KEY_SETUP_URL?: string;
  readonly VITE_APP_DOCS_URL?: string;
  readonly VITE_APP_STAKING_DASHBOARD_URL?: string;
  readonly VITE_APP_ENVIRONMENT?: string;
  readonly VITE_APP_SUPPORTED_CHAINS?: string;
  readonly VITE_APP_EXCHANGE_ORACLE_ADDRESS?: string;
  readonly VITE_APP_RECORDING_ORACLE_ADDRESS?: string;
  readonly VITE_APP_REPUTATION_ORACLE_ADDRESS?: string;
  readonly VITE_FOOTER_LINK_GITHUB?: string;
  readonly VITE_FOOTER_LINK_TELEGRAM?: string;
  readonly VITE_FOOTER_LINK_X?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

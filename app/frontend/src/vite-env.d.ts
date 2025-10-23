/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEBUG?: string;
  readonly VITE_APPLICATIONINSIGHTS_CONNECTION_STRING?: string;
  readonly VITE_APPLICATIONINSIGHTS_ROLE_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_ENVIRONMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

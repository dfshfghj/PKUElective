/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HIDE_AUTOMATION?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

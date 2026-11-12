/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_MODE?: string;
  readonly VITE_MAX_UPLOAD_SIZE_MB?: string;
  readonly VITE_MAX_VIDEO_DURATION_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

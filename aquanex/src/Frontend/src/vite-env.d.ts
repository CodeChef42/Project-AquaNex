declare module '*.css';

declare module '*.png' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
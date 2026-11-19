/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEDIA_BASE_URL?: string;
  readonly VITE_DEFAULT_SCENE_ID?: string;
  readonly VITE_DEFAULT_TRACK_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// navigator.connection (Network Information API) is not in the default lib types.
interface NetworkInformation {
  readonly saveData?: boolean;
  readonly effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}
interface Navigator {
  readonly connection?: NetworkInformation;
}

/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.svg' {
  const content: string
  export default content
}

interface TauriWindow {
  getCurrentWindow: () => {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    unmaximize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    startDragging: () => Promise<void>
  }
}

interface TauriAPI {
  window: TauriWindow
}

declare global {
  interface Window {
    __TAURI__: TauriAPI
  }
}
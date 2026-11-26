/** The app's version (from package.json, built in by Vite). Follows semantic versioning. */
export const APP_VERSION: string = __APP_VERSION__

declare global {
  const __APP_VERSION__: string
}

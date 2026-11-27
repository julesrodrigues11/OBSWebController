import { Component, type ReactNode } from 'react'

/**
 * Stops an error in one part of the page (e.g. the stats strip) from blanking the whole app.
 * Shows `fallback` (nothing by default) instead and logs the error to the console.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`[Stagehand] ${this.props.name} stopped working:`, error)
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

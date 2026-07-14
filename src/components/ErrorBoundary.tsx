import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('앱 오류', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-ink">문제가 발생했습니다.</p>
          <p className="text-xs text-muted">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-sm border border-line px-4 py-2 text-sm text-ink"
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

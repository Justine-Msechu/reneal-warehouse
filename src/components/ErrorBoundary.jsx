import { Component } from 'react'

// React error boundaries must be class components — there's no hook
// equivalent. Catches render errors anywhere below it so one broken page
// doesn't white-screen the entire app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6">
            This page ran into an unexpected error. Your data is safe — try reloading.
          </p>
          <button
            onClick={this.handleReload}
            className="bg-blue-700 text-white px-5 py-2 rounded font-medium hover:bg-blue-800 transition"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

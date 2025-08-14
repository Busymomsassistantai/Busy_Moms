import { useAuth } from './hooks/useAuth'
import AuthForm from './components/forms/AuthForm'
import Onboarding from './components/Onboarding'
import Dashboard from './components/Dashboard'
import Navigation from './components/Navigation'

function App() {
  const { user, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm />
  }

  if (!profile?.onboarding_completed) {
    return <Onboarding />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="pt-16">
        <Dashboard />
      </main>
    </div>
  )
}

export default App
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, useAuth, useClerk } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'
import AuthControls from './components/Auth/AuthControls.jsx'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Rendered INSIDE ClerkProvider — here Clerk hooks are safe to use.
function AuthedApp() {
  const { getToken, isSignedIn } = useAuth()
  const { openSignIn }           = useClerk()
  return (
    <App
      getToken={getToken}
      isSignedIn={!!isSignedIn}
      onRequireSignIn={() => openSignIn()}
      AuthControls={AuthControls}
    />
  )
}

// Clerk is optional. With no key, the app runs fully anonymous (no auth UI).
function Root() {
  if (!clerkKey) {
    return <App getToken={null} isSignedIn={false} AuthControls={null} />
  }
  return (
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
      <AuthedApp />
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

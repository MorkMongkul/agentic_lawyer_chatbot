import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'

// Sign-in button (signed out) / avatar menu (signed in).
// Only rendered when Clerk is configured (inside ClerkProvider).
export default function AuthControls() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border, #ddd)',
              background: '#BAEC17',
              color: '#1a1a1a',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ចូលគណនី
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}



## Fix: Double Sign-In Issue

### Root Cause

Race condition in `AuthContext.tsx`: After the initial page load with no session, `loading` is set to `false`. When the user signs in, `signIn()` immediately navigates to `/dashboard`, but the profile hasn't been fetched yet. Dashboard sees `loading === false` and `profile === null`, triggering a redirect back to `/login`.

Sequence:
1. App loads, no session → `loading = false`, `profile = null`
2. User signs in → `signIn()` navigates to `/dashboard`
3. `onAuthStateChange` fires → calls `fetchUserProfile` (async, takes time)
4. Dashboard renders → `loading` is still `false`, `profile` is still `null` → redirects to `/login`
5. Profile fetch completes too late — user is already back on login

### Fix

In `src/contexts/AuthContext.tsx`, update the `onAuthStateChange` callback to set `loading = true` when a new session arrives and profile needs to be fetched. This prevents the Dashboard guard from firing prematurely.

```typescript
// In onAuthStateChange callback:
if (session?.user) {
  if (initialSessionHandled) {
    setLoading(true);  // ← ADD THIS LINE
    fetchUserProfile(session.user.id);
  }
} else {
  setProfile(null);
  setLoading(false);
}
```

This single-line change ensures that when a sign-in event fires, `loading` goes back to `true` until the profile is fetched, preventing the premature redirect.


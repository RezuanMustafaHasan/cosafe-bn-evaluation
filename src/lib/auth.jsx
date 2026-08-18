import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import { auth, isDemoMode } from './firebase.js'
import { api } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) {
      const savedRole = localStorage.getItem('cosafe-demo-role')
      if (savedRole) setUser(api.demoUser(savedRole))
      setLoading(false)
      return undefined
    }
    if (!auth) {
      setLoading(false)
      return undefined
    }
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }
      try {
        setUser(await api.get('/me'))
      } catch {
        await firebaseSignOut(auth)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    async signIn(email, password) {
      setLoading(true)
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } finally {
        setLoading(false)
      }
    },
    demoSignIn(role) {
      localStorage.setItem('cosafe-demo-role', role)
      setUser(api.demoUser(role))
    },
    async signOut() {
      if (isDemoMode) {
        localStorage.removeItem('cosafe-demo-role')
        setUser(null)
      } else if (auth) {
        await firebaseSignOut(auth)
      }
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The hook intentionally shares this module with its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)

import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // Check for existing session on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('user')
        const savedToken = localStorage.getItem('token')

        if (savedUser && savedToken) {
            setUser(JSON.parse(savedUser))
            setIsAuthenticated(true)
        }
        setLoading(false)
    }, [])

    const login = async (email, password) => {
        try {
            const response = await api.post('/api/auth/login', { email, password })

            const userData = response.data.user
            const token = response.data.access_token

            // Save to localStorage
            localStorage.setItem('user', JSON.stringify(userData))
            localStorage.setItem('token', token)

            setUser(userData)
            setIsAuthenticated(true)

            return userData
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    }

    const register = async (email, name, password) => {
        try {
            const response = await api.post('/api/auth/register', { email, name, password })

            const userData = response.data.user
            const token = response.data.access_token

            // Save to localStorage
            localStorage.setItem('user', JSON.stringify(userData))
            localStorage.setItem('token', token)

            setUser(userData)
            setIsAuthenticated(true)

            return userData
        } catch (error) {
            console.error('Register error:', error)
            throw error
        }
    }

    const logout = () => {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        setUser(null)
        setIsAuthenticated(false)
    }

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthenticated,
            login,
            register,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

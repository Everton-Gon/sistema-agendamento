import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

function AuthCallback() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    useEffect(() => {
        const token = searchParams.get('token')
        const error = searchParams.get('error')

        if (error) {
            console.error('Authentication error:', error)
            navigate('/login')
            return
        }

        if (token) {
            localStorage.setItem('token', token)
            navigate('/')
        } else {
            navigate('/login')
        }
    }, [searchParams, navigate])

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gradient-primary)'
        }}>
            <div className="card" style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
                <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
                <h3>Autenticando...</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Por favor, aguarde enquanto processamos seu login.
                </p>
            </div>
        </div>
    )
}

export default AuthCallback

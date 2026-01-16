import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, User, Mail, ArrowRight } from 'lucide-react'
import api from '../services/api'

function DevLogin() {
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        email: '',
        name: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await api.post('/api/auth/dev-login', formData)

            // Save token
            localStorage.setItem('token', response.data.access_token)

            // Redirect to dashboard
            navigate('/')
        } catch (err) {
            console.error('Login error:', err)
            setError(err.response?.data?.detail || 'Erro ao fazer login')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-lg)'
        }}>
            <div className="card" style={{
                maxWidth: '400px',
                width: '100%',
                padding: 'var(--space-2xl)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'var(--gradient-primary)',
                        borderRadius: 'var(--radius-xl)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-lg)',
                        boxShadow: 'var(--shadow-lg)'
                    }}>
                        <Calendar size={40} color="white" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Modo Desenvolvimento</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Entre com qualquer email para testar o sistema
                    </p>
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: 'var(--space-sm)',
                        backgroundColor: 'var(--warning-light)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: '#b45309'
                    }}>
                        ⚠️ Azure AD não configurado. Usando login de desenvolvimento.
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">
                            <Mail size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="input"
                            placeholder="seu.email@empresa.com"
                            required
                        />
                    </div>

                    <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="input-label">
                            <User size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Nome
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input"
                            placeholder="Seu nome completo"
                            required
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: 'var(--space-md)',
                            marginBottom: 'var(--space-md)',
                            backgroundColor: 'var(--error-light)',
                            borderRadius: 'var(--radius-md)',
                            color: '#b91c1c',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                Entrando...
                            </>
                        ) : (
                            <>
                                Entrar no Sistema
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <p style={{
                    marginTop: 'var(--space-lg)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    textAlign: 'center'
                }}>
                    Para usar o login Microsoft, configure o Azure AD no arquivo .env
                </p>
            </div>
        </div>
    )
}

export default DevLogin

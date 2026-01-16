import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Mail, User, Lock, ArrowRight, UserPlus } from 'lucide-react'

function Register() {
    const navigate = useNavigate()
    const { register } = useAuth()
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        password: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!formData.email || !formData.name || !formData.password) {
            setError('Preencha todos os campos')
            return
        }

        if (formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres')
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem')
            return
        }

        setLoading(true)
        try {
            await register(formData.email, formData.name, formData.password)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.detail || 'Erro ao criar conta. Tente novamente.')
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
                maxWidth: '450px',
                width: '100%',
                padding: 'var(--space-2xl)',
                backgroundColor: 'white'
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
                        <UserPlus size={40} color="white" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Criar Conta</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Preencha os dados para se cadastrar
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">
                            <Mail size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            E-mail
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

                    <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">
                            <User size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Nome Completo
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

                    <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">
                            <Lock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Senha
                        </label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="input"
                            placeholder="Mínimo 6 caracteres"
                            required
                        />
                    </div>

                    <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="input-label">
                            <Lock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Confirmar Senha
                        </label>
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="input"
                            placeholder="Repita a senha"
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
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        style={{ width: '100%', marginBottom: 'var(--space-md)' }}
                    >
                        {loading ? (
                            <>
                                <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                Criando conta...
                            </>
                        ) : (
                            <>
                                Criar Conta
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    <p style={{
                        textAlign: 'center',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-secondary)'
                    }}>
                        Já tem uma conta?{' '}
                        <Link to="/login" style={{ color: 'var(--primary-600)', fontWeight: 500 }}>
                            Fazer login
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    )
}

export default Register

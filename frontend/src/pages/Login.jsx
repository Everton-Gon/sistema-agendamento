import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Users, Clock, Shield, Mail, Lock, ArrowRight } from 'lucide-react'

function Login() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!formData.email || !formData.password) {
            setError('Preencha todos os campos')
            return
        }

        setLoading(true)
        try {
            await login(formData.email, formData.password)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.detail || 'E-mail ou senha incorretos')
        } finally {
            setLoading(false)
        }
    }

    const features = [
        { icon: Calendar, title: 'Calendário Integrado', description: 'Visualize todas as reuniões em um calendário intuitivo' },
        { icon: Users, title: '6 Salas Disponíveis', description: 'Escolha entre 6 salas de reunião equipadas' },
        { icon: Clock, title: 'Sem Conflitos', description: 'Sistema inteligente evita agendamentos duplicados' },
        { icon: Shield, title: 'Seguro', description: 'Suas reuniões protegidas com autenticação' }
    ]

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-lg)'
        }}>
            <div className="card card-glass" style={{
                maxWidth: '900px',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                overflow: 'hidden'
            }}>
                {/* Left side - Features */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(241, 168, 99, 0.9), rgba(246, 161, 92, 0.9))',
                    padding: 'var(--space-2xl)',
                    color: 'white'
                }}>
                    <h1 style={{ marginBottom: 'var(--space-sm)' }}>
                        📅 Sistema de Agendamento
                    </h1>
                    <p style={{
                        opacity: 0.9,
                        marginBottom: 'var(--space-2xl)',
                        fontSize: 'var(--font-size-lg)'
                    }}>
                        Gerencie suas reuniões de forma simples e eficiente
                    </p>

                    <div className="flex flex-col gap-lg">
                        {features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-md">
                                <div style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--space-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <feature.icon size={24} />
                                </div>
                                <div>
                                    <h4 style={{ marginBottom: '2px' }}>{feature.title}</h4>
                                    <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.8 }}>
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right side - Login Form */}
                <div style={{
                    padding: 'var(--space-2xl)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    backgroundColor: 'white'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: 'var(--gradient-tertiary)',
                            borderRadius: 'var(--radius-xl)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto var(--space-lg)',
                            boxShadow: 'var(--shadow-lg)'
                        }}>
                            <Calendar size={40} color="white" />
                        </div>
                        <h2 style={{ marginBottom: 'var(--space-sm)' }}>Bem-vindo!</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Entre com suas credenciais
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

                        <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                            <label className="input-label">
                                <Lock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                Senha
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="input"
                                placeholder="Sua senha"
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
                            style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                    Entrando...
                                </>
                            ) : (
                                <>
                                    Entrar
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
                            <Link
                                to="/forgot-password"
                                style={{
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)',
                                    textDecoration: 'none'
                                }}
                            >
                                Esqueci minha senha
                            </Link>
                        </div>

                        <p style={{
                            textAlign: 'center',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text-secondary)'
                        }}>
                            Não tem uma conta?{' '}
                            <Link to="/register" style={{ color: 'var(--primary-600)', fontWeight: 500 }}>
                                Criar conta
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Login

import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

function ResetPassword() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const token = searchParams.get('token')

    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [tokenValid, setTokenValid] = useState(true)

    useEffect(() => {
        if (!token) {
            setTokenValid(false)
        }
    }, [token])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

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
            await api.post('/api/auth/reset-password', {
                token,
                new_password: formData.password
            })
            setSuccess(true)
            // Redireciona para login após 3 segundos
            setTimeout(() => {
                navigate('/login')
            }, 3000)
        } catch (err) {
            const detail = err.response?.data?.detail
            if (detail === 'Token inválido ou expirado') {
                setTokenValid(false)
            } else {
                setError(detail || 'Erro ao redefinir senha. Tente novamente.')
            }
        } finally {
            setLoading(false)
        }
    }

    // Token inválido ou expirado
    if (!tokenValid) {
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
                    backgroundColor: 'white',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'var(--error-light)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-lg)'
                    }}>
                        <AlertCircle size={40} color="var(--error)" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Link Inválido</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Este link de recuperação de senha é inválido ou já expirou.
                    </p>
                    <Link to="/forgot-password" className="btn btn-primary" style={{ width: '100%', marginBottom: 'var(--space-sm)' }}>
                        Solicitar Novo Link
                    </Link>
                    <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }}>
                        <ArrowLeft size={18} />
                        Voltar para o Login
                    </Link>
                </div>
            </div>
        )
    }

    // Sucesso
    if (success) {
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
                    backgroundColor: 'white',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'var(--success-light)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-lg)'
                    }}>
                        <CheckCircle size={40} color="var(--success)" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Senha Redefinida!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Sua senha foi alterada com sucesso. Você será redirecionado para o login...
                    </p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                        Ir para o Login
                    </Link>
                </div>
            </div>
        )
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
                        background: 'var(--gradient-tertiary)',
                        borderRadius: 'var(--radius-xl)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-lg)',
                        boxShadow: 'var(--shadow-lg)'
                    }}>
                        <Lock size={40} color="white" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Redefinir Senha</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Digite sua nova senha
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="input-label">
                            <Lock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Nova Senha
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="input"
                                placeholder="Mínimo 6 caracteres"
                                required
                                style={{ paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="input-label">
                            <Lock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            Confirmar Nova Senha
                        </label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="input"
                            placeholder="Repita a nova senha"
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
                                Redefinindo...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                Redefinir Senha
                            </>
                        )}
                    </button>

                    <Link
                        to="/login"
                        className="btn btn-secondary"
                        style={{ width: '100%', textDecoration: 'none' }}
                    >
                        <ArrowLeft size={18} />
                        Voltar para o Login
                    </Link>
                </form>
            </div>
        </div>
    )
}

export default ResetPassword

/**
 * =============================================================
 *   ResetPassword.jsx — Página de redefinição de senha
 * =============================================================
 *   Responsável por:
 *   - Permitir ao usuário definir uma nova senha
 *   - Validar token recebido por email (query string ?token=...)
 *   - Exibir tela de erro se token inválido ou expirado
 *   - Exibir tela de sucesso após redefinição
 *   - Redirecionar para login após 3 segundos
 *   
 *   Fluxo:
 *   1. Usuário clica no link recebido por email
 *   2. URL contém: /reset-password?token=abc123
 *   3. Usuário digita nova senha + confirmação
 *   4. Sistema envia POST /api/auth/reset-password { token, new_password }
 *   5. Tela de sucesso + redirecionamento automático para login
 *   
 *   Estados possíveis:
 *   - Token inválido → tela de erro com link para solicitar novo
 *   - Sucesso → tela de confirmação + redirecionamento
 *   - Formulário → campos de nova senha + confirmação
 * =============================================================
 */

import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

function ResetPassword() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const token = searchParams.get('token')  // Token de reset extraído da URL

    // Estado do formulário
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)       // Indica requisição em andamento
    const [error, setError] = useState('')               // Mensagem de erro
    const [success, setSuccess] = useState(false)        // Controla tela de sucesso
    const [showPassword, setShowPassword] = useState(false)  // Toggle mostrar/ocultar senha
    const [tokenValid, setTokenValid] = useState(true)   // Token é válido?

    // Verifica se o token existe na URL ao carregar a página
    useEffect(() => {
        if (!token) {
            setTokenValid(false)  // Sem token → tela de erro
        }
    }, [token])

    /**
     * Submete a nova senha.
     * 1. Valida tamanho mínimo (6 caracteres)
     * 2. Verifica se senhas coincidem
     * 3. Envia POST /api/auth/reset-password com token + nova senha
     * 4. Em caso de token expirado, mostra tela de erro
     * 5. Em caso de sucesso, redireciona para login após 3 segundos
     */
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // Validação: tamanho mínimo
        if (formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres')
            return
        }

        // Validação: senhas coincidem
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

            // Redireciona automaticamente para login após 3 segundos
            setTimeout(() => {
                navigate('/login')
            }, 3000)
        } catch (err) {
            const detail = err.response?.data?.detail
            if (detail === 'Token inválido ou expirado') {
                setTokenValid(false)  // Muda para tela de token inválido
            } else {
                setError(detail || 'Erro ao redefinir senha. Tente novamente.')
            }
        } finally {
            setLoading(false)
        }
    }

    // === ESTADO 1: Token inválido ou expirado ===
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
                    {/* Ícone de erro (círculo vermelho) */}
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
                    {/* Botão para solicitar novo link */}
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

    // === ESTADO 2: Senha redefinida com sucesso ===
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
                    {/* Ícone de sucesso (check verde) */}
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

    // === ESTADO 3: Formulário de redefinição de senha ===
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
                {/* Cabeçalho: ícone de cadeado + título */}
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
                    {/* Campo: Nova senha (com toggle mostrar/ocultar) */}
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
                            {/* Botão olho — alterna visibilidade da senha */}
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

                    {/* Campo: Confirmar nova senha */}
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

                    {/* Mensagem de erro */}
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

                    {/* Botão de submit */}
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

                    {/* Botão para voltar ao login */}
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

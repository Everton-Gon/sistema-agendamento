/**
 * =============================================================
 *   Login.jsx — Página de login da aplicação
 * =============================================================
 *   Responsável por:
 *   - Autenticar o usuário via email/senha
 *   - Exibir painel esquerdo com features do sistema
 *   - Exibir formulário de login no painel direito
 *   - Redirecionar para Dashboard após login bem-sucedido
 *   - Links para "Esqueci minha senha" e "Criar conta"
 *   
 *   Layout (split-screen):
 *   ┌──────────────────┬──────────────────┐
 *   │  Features do     │  Formulário de   │
 *   │  Sistema         │  Login           │
 *   │  (fundo laranja) │  (fundo branco)  │
 *   └──────────────────┴──────────────────┘
 * =============================================================
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Users, Clock, Shield, Mail, Lock, ArrowRight } from 'lucide-react'

function Login() {
    const navigate = useNavigate()
    const { login, loginMicrosoft } = useAuth()

    // Estado do formulário (email + senha)
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })
    const [loading, setLoading] = useState(false)       // Indica requisição em andamento
    const [msLoading, setMsLoading] = useState(false)   // Indica login Microsoft em andamento
    const [error, setError] = useState('')              // Mensagem de erro para o usuário

    /**
     * Submete o formulário de login.
     * 1. Valida campos obrigatórios
     * 2. Chama login() do AuthContext (POST /api/auth/login)
     * 3. Redireciona para "/" (Dashboard) em caso de sucesso
     * 4. Exibe mensagem de erro do backend em caso de falha
     */
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // Validação básica — campos obrigatórios
        if (!formData.email || !formData.password) {
            setError('Preencha todos os campos')
            return
        }

        setLoading(true)
        try {
            await login(formData.email, formData.password)
            navigate('/')  // Sucesso → redireciona para Dashboard
        } catch (err) {
            // Exibe mensagem do backend ou mensagem genérica
            setError(err.response?.data?.detail || 'E-mail ou senha incorretos')
        } finally {
            setLoading(false)
        }
    }

    /**
     * Inicia o fluxo de login com conta Microsoft.
     * Abre o popup de autenticação da Microsoft e redireciona ao Dashboard.
     */
    const handleMicrosoftLogin = async () => {
        setError('')
        setMsLoading(true)
        try {
            await loginMicrosoft()
            navigate('/')  // Sucesso → redireciona para Dashboard
        } catch (err) {
            if (err?.message?.includes('user_cancelled') || err?.errorCode === 'user_cancelled') {
                // Usuário fechou o popup — não exibe erro
                return
            }
            setError(err.response?.data?.detail || 'Erro ao conectar com a Microsoft. Tente novamente.')
        } finally {
            setMsLoading(false)
        }
    }

    // Lista de features exibidas no painel esquerdo (marketing)
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
            {/* Card principal com layout em 2 colunas (split-screen) */}
            <div className="card card-glass login-container" style={{
                maxWidth: '900px',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                overflow: 'hidden'
            }}>
                {/* === PAINEL ESQUERDO: Features do sistema === */}
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

                    {/* Lista de features com ícones */}
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

                {/* === PAINEL DIREITO: Formulário de Login === */}
                <div style={{
                    padding: 'var(--space-2xl)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    backgroundColor: 'white'
                }}>
                    {/* Cabeçalho com ícone e mensagem de boas-vindas */}
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

                    {/* Formulário de login */}
                    <form onSubmit={handleSubmit}>
                        {/* Campo: E-mail */}
                        {/* <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
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
                        </div> */}

                        {/* Campo: Senha */}
                        {/* <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
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
                        </div> */}

                        {/* Mensagem de erro — exibida condicionalmente */}
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

                        {/* Botão de submit — mostra spinner durante carregamento */}
                        {/* <button
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
                        </button> */}

                        {/* Link para recuperação de senha */}
                        {/* <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
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
                        </div> */}

                        {/* Separador visual entre os métodos de login */}
                        {/* <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-md)',
                            margin: 'var(--space-md) 0'
                        }}>
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color, #e5e7eb)' }} />
                            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>ou</span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color, #e5e7eb)' }} />
                        </div> */}

                        {/* Botão: Entrar com Microsoft */}
                        <button
                            type="button"
                            onClick={handleMicrosoftLogin}
                            disabled={msLoading || loading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 'var(--space-sm)',
                                padding: '10px var(--space-lg)',
                                border: '1.5px solid #d1d5db',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'white',
                                color: '#374151',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 500,
                                cursor: msLoading || loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                marginBottom: 'var(--space-md)',
                                opacity: msLoading || loading ? 0.7 : 1,
                            }}
                            onMouseEnter={e => { if (!msLoading && !loading) e.currentTarget.style.backgroundColor = '#f9fafb' }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white' }}
                        >
                            {msLoading ? (
                                <div className="spinner spinner-sm" />
                            ) : (
                                /* Logo oficial da Microsoft */
                                <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                                </svg>
                            )}
                            {msLoading ? 'Conectando...' : 'Entrar com Microsoft'}
                        </button>

                        {/* Link para criação de conta */}
                        {/* <p style={{
                            textAlign: 'center',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text-secondary)'
                        }}>
                            Não tem uma conta?{' '}
                            <Link to="/register" style={{ color: 'var(--primary-600)', fontWeight: 500 }}>
                                Criar conta
                            </Link>
                        </p> */}
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Login

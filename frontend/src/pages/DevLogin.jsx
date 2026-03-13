/**
 * =============================================================
 *   DevLogin.jsx — Login de desenvolvimento (sem Azure AD)
 * =============================================================
 *   Responsável por:
 *   - Permitir login simplificado para desenvolvimento/testes
 *   - Funciona quando Azure AD NÃO está configurado
 *   - Aceita qualquer email/nome (sem validação de credenciais)
 *   - Chama POST /api/auth/dev-login para obter token JWT
 *   
 *   IMPORTANTE:
 *   - Este componente é usado apenas em modo de desenvolvimento
 *   - Em produção, o login deve ser feito via Azure AD (Login.jsx)
 *   - Exibe aviso visual amarelo indicando modo de desenvolvimento
 *   
 *   Fluxo:
 *   1. Usuário digita email e nome
 *   2. Sistema chama /api/auth/dev-login
 *   3. Backend retorna token JWT sem verificar credenciais
 *   4. Token é salvo no localStorage
 *   5. Redireciona para "/" (Dashboard)
 * =============================================================
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, User, Mail, ArrowRight } from 'lucide-react'
import api from '../services/api'

function DevLogin() {
    const navigate = useNavigate()

    // Estado do formulário (email + nome)
    const [formData, setFormData] = useState({
        email: '',
        name: ''
    })
    const [loading, setLoading] = useState(false)    // Indica requisição em andamento
    const [error, setError] = useState('')            // Mensagem de erro

    /**
     * Submete o formulário de login de desenvolvimento.
     * 1. Envia dados para POST /api/auth/dev-login
     * 2. Recebe token JWT sem autenticação real
     * 3. Salva token no localStorage
     * 4. Redireciona para Dashboard
     */
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await api.post('/api/auth/dev-login', formData)

            // Salva token JWT no localStorage
            localStorage.setItem('token', response.data.access_token)

            // Redireciona para o dashboard
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
                {/* Cabeçalho: ícone + título + aviso de modo dev */}
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
                    {/* Aviso visual: Azure AD não configurado */}
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

                {/* Formulário simplificado (email + nome) */}
                <form onSubmit={handleSubmit}>
                    {/* Campo: Email */}
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

                    {/* Campo: Nome */}
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

                {/* Dica: como ativar login Microsoft */}
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

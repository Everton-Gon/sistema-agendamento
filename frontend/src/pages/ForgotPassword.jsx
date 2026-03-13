/**
 * =============================================================
 *   ForgotPassword.jsx — Página de recuperação de senha
 * =============================================================
 *   Responsável por:
 *   - Permitir ao usuário solicitar um link de recuperação de senha
 *   - Enviar o email para o backend (POST /api/auth/forgot-password)
 *   - Exibir tela de sucesso após envio bem-sucedido
 *   - Links para retornar à tela de login
 *   
 *   Fluxo:
 *   1. Usuário digita o email
 *   2. Sistema envia link de recuperação por email
 *   3. Tela muda para estado de "sucesso" confirmando o envio
 *   4. Usuário verifica email e clica no link (→ ResetPassword.jsx)
 * =============================================================
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react'

function ForgotPassword() {
    const [email, setEmail] = useState('')         // Email digitado pelo usuário
    const [loading, setLoading] = useState(false)  // Indica requisição em andamento
    const [error, setError] = useState('')          // Mensagem de erro
    const [success, setSuccess] = useState(false)  // Controla exibição da tela de sucesso

    /**
     * Envia solicitação de recuperação de senha.
     * Chama POST /api/auth/forgot-password com o email.
     * Em caso de sucesso, muda para a tela de confirmação.
     */
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!email) {
            setError('Digite seu e-mail')
            return
        }

        setLoading(true)
        try {
            await api.post('/api/auth/forgot-password', { email })
            setSuccess(true)  // Muda para tela de sucesso
        } catch (err) {
            setError(err.response?.data?.detail || 'Erro ao enviar e-mail. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    // === TELA DE SUCESSO — exibida após envio bem-sucedido ===
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
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>E-mail Enviado!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
                        Verifique também sua pasta de spam.
                    </p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                        <ArrowLeft size={18} />
                        Voltar para o Login
                    </Link>
                </div>
            </div>
        )
    }

    // === TELA PRINCIPAL — formulário de recuperação ===
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
                {/* Cabeçalho: ícone de email + título */}
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
                        <Mail size={40} color="white" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Esqueci minha senha</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Digite seu e-mail para receber um link de recuperação
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Campo: E-mail */}
                    <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                        <label className="input-label">
                            <Mail size={14} style={{ display: 'inline', marginRight: '4px' }} />
                            E-mail
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input"
                            placeholder="seu.email@empresa.com"
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

                    {/* Botão de envio */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        style={{ width: '100%', marginBottom: 'var(--space-md)' }}
                    >
                        {loading ? (
                            <>
                                <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                Enviar Link de Recuperação
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

export default ForgotPassword

/**
 * =============================================================
 *   Register.jsx — Página de cadastro de novo usuário
 * =============================================================
 *   Responsável por:
 *   - Cadastrar um novo usuário no sistema
 *   - Validar campos obrigatórios e regras de senha
 *   - Verificar se senhas coincidem antes de enviar
 *   - Redirecionar para Dashboard após cadastro bem-sucedido
 *   - Link para "Fazer login" caso já tenha conta
 *   
 *   Validações:
 *   - Todos os campos obrigatórios preenchidos
 *   - Senha com no mínimo 6 caracteres
 *   - Confirmação de senha idêntica à senha
 * =============================================================
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Mail, User, Lock, ArrowRight, UserPlus } from 'lucide-react'

function Register() {
    const navigate = useNavigate()
    const { register } = useAuth()

    // Estado do formulário com 4 campos
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        password: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)    // Indica requisição em andamento
    const [error, setError] = useState('')            // Mensagem de erro para o usuário

    /**
     * Submete o formulário de cadastro.
     * 1. Valida campos obrigatórios
     * 2. Verifica tamanho mínimo da senha (6 caracteres)
     * 3. Confirma que ambas as senhas são iguais
     * 4. Chama register() do AuthContext (POST /api/auth/register)
     * 5. Redireciona para "/" (Dashboard) em caso de sucesso
     */
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // Validação: campos obrigatórios
        if (!formData.email || !formData.name || !formData.password) {
            setError('Preencha todos os campos')
            return
        }

        // Validação: tamanho mínimo da senha
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
            await register(formData.email, formData.name, formData.password)
            navigate('/')  // Sucesso → redireciona para Dashboard
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
            {/* Card centralizado com formulário de cadastro */}
            <div className="card" style={{
                maxWidth: '450px',
                width: '100%',
                padding: 'var(--space-2xl)',
                backgroundColor: 'white'
            }}>
                {/* Cabeçalho: ícone + título */}
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
                        <UserPlus size={40} color="white" />
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Criar Conta</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Preencha os dados para se cadastrar
                    </p>
                </div>

                {/* Formulário de cadastro */}
                <form onSubmit={handleSubmit}>
                    {/* Campo: E-mail */}
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

                    {/* Campo: Nome completo */}
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

                    {/* Campo: Senha */}
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

                    {/* Campo: Confirmar senha */}
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

                    {/* Link para login (se já tem conta) */}
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

/**
 * =============================================================
 *   AuthContext.jsx — Contexto global de autenticação
 * =============================================================
 *   Responsável por:
 *   - Gerenciar o estado de autenticação (logado/deslogado)
 *   - Persistir sessão via localStorage (sobrevive a refresh)
 *   - Expor funções login(), loginMicrosoft(), register() e logout()
 *   - Fornecer dados do usuário logado (nome, email, tipo)
 *   
 *   Como usar em qualquer componente:
 *   const { user, login, loginMicrosoft, logout, isAuthenticated } = useAuth()
 * =============================================================
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import api from '../services/api'
import { loginRequest } from '../services/authConfig'

// Detecta se o usuário está em dispositivo móvel
const isMobile = () => /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)

// Cria o contexto de autenticação (valor inicial: null)
const AuthContext = createContext(null)

/**
 * AuthProvider — Provider que envolve toda a aplicação.
 * Gerencia o estado de autenticação e expõe via Context API.
 * 
 * Estado:
 * - user: dados do usuário logado (nome, email, tipo) ou null
 * - loading: true enquanto verifica sessão salva no localStorage
 * - isAuthenticated: true se há usuário logado
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)              // Dados do usuário logado
    const [loading, setLoading] = useState(true)         // Carregando sessão salva?
    const [isAuthenticated, setIsAuthenticated] = useState(false)  // Está logado?

    // Instância do MSAL para interações com a Microsoft
    const { instance: msalInstance } = useMsal()

    /**
     * Efeito executado ao montar o componente (apenas 1 vez).
     * Verifica se há sessão salva no localStorage.
     * Se houver, restaura o estado do usuário sem precisar logar novamente.
     */
    useEffect(() => {
        const savedUser = localStorage.getItem('user')    // Dados do usuário em JSON
        const savedToken = localStorage.getItem('token')  // Token JWT

        if (savedUser && savedToken) {
            setUser(JSON.parse(savedUser))
            setIsAuthenticated(true)
        }
        setLoading(false)  // Finaliza o carregamento (permite renderizar as rotas)

        // Trata o resultado do redirect da Microsoft (fluxo mobile)
        handleMicrosoftRedirectResult()
    }, [handleMicrosoftRedirectResult])

    /**
     * Faz login com email e senha.
     * Envia credenciais ao backend, recebe token JWT e dados do usuário.
     * Salva ambos no localStorage para persistir a sessão.
     * 
     * @param {string} email - Email do usuário
     * @param {string} password - Senha do usuário
     * @returns {Object} Dados do usuário logado
     * @throws {Error} Se as credenciais estiverem incorretas
     */
    const login = async (email, password) => {
        try {
            const response = await api.post('/api/auth/login', { email, password })

            const userData = response.data.user          // { id, name, email, tipo }
            const token = response.data.access_token     // JWT token

            // Persiste no localStorage (sobrevive a refresh da página)
            localStorage.setItem('user', JSON.stringify(userData))
            localStorage.setItem('token', token)

            // Atualiza o estado global
            setUser(userData)
            setIsAuthenticated(true)

            return userData
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    }

    /**
     * Faz login com a conta corporativa da Microsoft (SSO).
     * 
     * Fluxo:
     * 1. Abre o popup de login da Microsoft (MSAL)
     * 2. Recebe o access_token da Microsoft
     * 3. Envia o token ao backend (POST /api/auth/microsoft)
     * 4. Backend valida o token, cria usuário se necessário e retorna JWT próprio
     * 5. Salva sessão no localStorage igual ao login normal
     * 
     * @returns {Object} Dados do usuário logado
     * @throws {Error} Se o login falhar ou o usuário cancelar
     */
    // Processa resultado do redirect (mobile) após retorno da Microsoft
    const handleMicrosoftRedirectResult = useCallback(async () => {
        try {
            const result = await msalInstance.handleRedirectPromise()
            if (!result) return // Nenhum redirect pendente

            const microsoftToken = result.accessToken
            const response = await api.post('/api/auth/microsoft', {
                access_token: microsoftToken
            })

            const userData = response.data.user
            const token = response.data.access_token

            localStorage.setItem('user', JSON.stringify(userData))
            localStorage.setItem('token', token)
            setUser(userData)
            setIsAuthenticated(true)
        } catch (error) {
            console.error('Microsoft redirect result error:', error)
        }
    }, [msalInstance])

    const loginMicrosoft = async () => {
        try {
            if (isMobile()) {
                // Mobile: usa redirect (popup é bloqueado em browsers mobile)
                await msalInstance.loginRedirect(loginRequest)
                return // A página vai redirecionar; o resultado é tratado em handleMicrosoftRedirectResult
            }

            // Desktop: usa popup
            const result = await msalInstance.loginPopup(loginRequest)

            const microsoftToken = result.accessToken
            const response = await api.post('/api/auth/microsoft', {
                access_token: microsoftToken
            })

            const userData = response.data.user
            const token = response.data.access_token

            localStorage.setItem('user', JSON.stringify(userData))
            localStorage.setItem('token', token)
            setUser(userData)
            setIsAuthenticated(true)

            return userData
        } catch (error) {
            if (error instanceof InteractionRequiredAuthError) {
                console.warn('Interação necessária para login Microsoft')
            }
            console.error('Microsoft login error:', error)
            throw error
        }
    }

    /**
     * Registra um novo usuário.
     * Cria a conta no backend e faz login automático.
     * 
     * @param {string} email - Email para cadastro
     * @param {string} name - Nome completo
     * @param {string} password - Senha escolhida
     * @returns {Object} Dados do usuário criado
     * @throws {Error} Se o email já está cadastrado ou dados inválidos
     */
    const register = async (email, name, password) => {
        try {
            const response = await api.post('/api/auth/register', { email, name, password })

            const userData = response.data.user
            const token = response.data.access_token

            // Salva sessão automaticamente após registro
            localStorage.setItem('user', JSON.stringify(userData))
            localStorage.setItem('token', token)

            setUser(userData)
            setIsAuthenticated(true)

            return userData
        } catch (error) {
            console.error('Register error:', error)
            throw error
        }
    }

    /**
     * Faz logout do usuário.
     * Remove dados do localStorage e reseta o estado.
     * O interceptor do Axios irá parar de enviar o token.
     */
    const logout = () => {
        localStorage.removeItem('user')    // Remove dados do usuário
        localStorage.removeItem('token')   // Remove token JWT
        setUser(null)
        setIsAuthenticated(false)
    }

    // Provê o contexto para todos os componentes filhos
    return (
        <AuthContext.Provider value={{
            user,              // Dados do usuário logado (ou null)
            loading,           // true enquanto verifica sessão
            isAuthenticated,   // true se logado
            login,             // Função para fazer login com email/senha
            loginMicrosoft,    // Função para fazer login com conta Microsoft
            register,          // Função para registrar
            logout             // Função para fazer logout
        }}>
            {children}
        </AuthContext.Provider>
    )
}

/**
 * Hook customizado para acessar o contexto de autenticação.
 * Deve ser usado dentro de um AuthProvider.
 * 
 * Exemplo de uso:
 * const { user, login, loginMicrosoft, logout } = useAuth()
 * 
 * @returns {Object} { user, loading, isAuthenticated, login, loginMicrosoft, register, logout }
 * @throws {Error} Se usado fora do AuthProvider
 */
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

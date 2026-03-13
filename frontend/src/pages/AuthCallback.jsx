/**
 * =============================================================
 *   AuthCallback.jsx — Página de callback de autenticação OAuth
 * =============================================================
 *   Responsável por:
 *   - Processar o retorno da autenticação via Microsoft/Azure AD
 *   - Extrair o token JWT da URL (query string ?token=...)
 *   - Salvar o token no localStorage
 *   - Redirecionar para o Dashboard ou Login conforme resultado
 *   
 *   Fluxo OAuth:
 *   1. Usuário clica em "Login com Microsoft" (no Login.jsx)
 *   2. É redirecionado para a página de autenticação da Microsoft
 *   3. Após autenticar, Microsoft redireciona de volta para:
 *      /auth/callback?token=eyJhbGciOi...
 *   4. Este componente captura o token e salva no localStorage
 *   5. Redireciona para "/" (Dashboard)
 *   
 *   Em caso de erro:
 *   - Se ?error= estiver presente → redireciona para /login
 *   - Se ?token= estiver ausente → redireciona para /login
 * =============================================================
 */

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

function AuthCallback() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()  // Captura parâmetros da URL

    useEffect(() => {
        const token = searchParams.get('token')    // JWT retornado pelo backend
        const error = searchParams.get('error')    // Erro retornado (se houver)

        // Se houve erro na autenticação → volta para login
        if (error) {
            console.error('Authentication error:', error)
            navigate('/login')
            return
        }

        // Se recebeu token → salva e redireciona para Dashboard
        if (token) {
            localStorage.setItem('token', token)
            navigate('/')
        } else {
            // Sem token e sem erro → volta para login
            navigate('/login')
        }
    }, [searchParams, navigate])

    // Tela de loading enquanto processa o callback
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gradient-primary)'
        }}>
            <div className="card" style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
                <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-lg)' }} />
                <h3>Autenticando...</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Por favor, aguarde enquanto processamos seu login.
                </p>
            </div>
        </div>
    )
}

export default AuthCallback

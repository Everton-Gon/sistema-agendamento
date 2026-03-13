/**
 * =============================================================
 *   App.jsx — Componente principal e roteamento da aplicação
 * =============================================================
 *   Responsável por:
 *   - Definir todas as rotas da aplicação (públicas e privadas)
 *   - Implementar guardas de rota (PrivateRoute / PublicRoute)
 *   - Redirecionar usuários não autenticados para /login
 *   - Redirecionar usuários autenticados para o dashboard
 *   
 *   Estrutura de rotas:
 *   - Públicas: /login, /register, /forgot-password, /reset-password
 *   - Semi-pública: /meeting-response (resposta a convite, sem login)
 *   - Privadas: /, /calendar, /new-meeting, /my-meetings, /rooms
 * =============================================================
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import MeetingResponse from './pages/MeetingResponse'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import NewMeeting from './pages/NewMeeting'
import MyMeetings from './pages/MyMeetings'
import Rooms from './pages/Rooms'

/**
 * PrivateRoute — Guarda para rotas que exigem autenticação.
 * Se o usuário não está logado, redireciona para /login.
 * Enquanto verifica o estado de auth, exibe um spinner de carregamento.
 */
function PrivateRoute({ children }) {
    const { isAuthenticated, loading } = useAuth()

    // Exibe spinner enquanto verifica se há sessão salva no localStorage
    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
                <div className="spinner spinner-lg"></div>
            </div>
        )
    }

    // Se autenticado, renderiza o conteúdo; senão, redireciona para login
    return isAuthenticated ? children : <Navigate to="/login" />
}

/**
 * PublicRoute — Guarda para rotas públicas (login, registro).
 * Se o usuário já está logado, redireciona para o dashboard (/).
 * Impede que um usuário logado acesse a tela de login novamente.
 */
function PublicRoute({ children }) {
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
                <div className="spinner spinner-lg"></div>
            </div>
        )
    }

    // Se já está autenticado, vai para o dashboard
    return isAuthenticated ? <Navigate to="/" /> : children
}

/**
 * App — Componente principal que define o mapa de rotas.
 * 
 * Rotas públicas: acessíveis sem login
 * Rotas privadas: envolvidas pelo Layout (sidebar + header) e protegidas
 * Rota catch-all (*): redireciona para a raiz
 */
function App() {
    return (
        <Routes>
            {/* === ROTAS PÚBLICAS === */}
            {/* Acessíveis apenas para usuários NÃO autenticados */}
            <Route path="/login" element={
                <PublicRoute>
                    <Login />
                </PublicRoute>
            } />
            <Route path="/register" element={
                <PublicRoute>
                    <Register />
                </PublicRoute>
            } />
            <Route path="/forgot-password" element={
                <PublicRoute>
                    <ForgotPassword />
                </PublicRoute>
            } />
            <Route path="/reset-password" element={
                <PublicRoute>
                    <ResetPassword />
                </PublicRoute>
            } />

            {/* Rota semi-pública: resposta a convite de reunião (não precisa de login) */}
            {/* O participante clica no link do e-mail e chega aqui */}
            <Route path="/meeting-response" element={<MeetingResponse />} />

            {/* === ROTAS PRIVADAS === */}
            {/* Todas envolvidas pelo Layout (sidebar + header + conteúdo) */}
            <Route path="/" element={
                <PrivateRoute>
                    <Layout />
                </PrivateRoute>
            }>
                {/* index = rota padrão "/" → Dashboard */}
                <Route index element={<Dashboard />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="new-meeting" element={<NewMeeting />} />
                <Route path="my-meetings" element={<MyMeetings />} />
                <Route path="rooms" element={<Rooms />} />
            </Route>

            {/* Catch-all: qualquer rota inválida redireciona para "/" */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    )
}

export default App


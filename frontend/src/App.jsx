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

function PrivateRoute({ children }) {
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
                <div className="spinner spinner-lg"></div>
            </div>
        )
    }

    return isAuthenticated ? children : <Navigate to="/login" />
}

function PublicRoute({ children }) {
    const { isAuthenticated, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
                <div className="spinner spinner-lg"></div>
            </div>
        )
    }

    return isAuthenticated ? <Navigate to="/" /> : children
}

function App() {
    return (
        <Routes>
            {/* Public Routes */}
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

            {/* Rota pública para resposta de convite (não precisa de login) */}
            <Route path="/meeting-response" element={<MeetingResponse />} />

            {/* Private Routes */}
            <Route path="/" element={
                <PrivateRoute>
                    <Layout />
                </PrivateRoute>
            }>
                <Route index element={<Dashboard />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="new-meeting" element={<NewMeeting />} />
                <Route path="my-meetings" element={<MyMeetings />} />
                <Route path="rooms" element={<Rooms />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    )
}

export default App


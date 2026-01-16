import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Calendar, Clock, Building2, User, AlertCircle, Loader } from 'lucide-react'

// URL base do backend
const API_BASE = 'http://localhost:8000'

function MeetingResponse() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')
    const response = searchParams.get('response')

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [meetingInfo, setMeetingInfo] = useState(null)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    useEffect(() => {
        if (!token) {
            setError('Link inválido')
            setLoading(false)
            return
        }
        loadMeetingInfo()
    }, [token])

    useEffect(() => {
        // Se recebeu o response na URL, enviar automaticamente
        if (meetingInfo && response && !success) {
            handleResponse(response)
        }
    }, [meetingInfo, response])

    async function loadMeetingInfo() {
        try {
            // Usar fetch nativo para evitar interceptor de autenticação
            const res = await fetch(`${API_BASE}/api/meeting-confirmation/respond-info?token=${token}`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || 'Erro ao carregar informações')
            }
            const data = await res.json()
            setMeetingInfo(data)
        } catch (err) {
            setError(err.message || 'Link inválido ou expirado')
        } finally {
            setLoading(false)
        }
    }

    async function handleResponse(responseType) {
        setSubmitting(true)
        try {
            // Usar fetch nativo para evitar interceptor de autenticação
            const res = await fetch(`${API_BASE}/api/meeting-confirmation/respond?token=${token}&response=${responseType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || 'Erro ao registrar resposta')
            }
            const data = await res.json()
            setSuccess(data)
        } catch (err) {
            setError(err.message || 'Erro ao registrar resposta')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="spinner spinner-lg"></div>
            </div>
        )
    }

    if (error) {
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
                        {error}
                    </p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                        Ir para o Login
                    </Link>
                </div>
            </div>
        )
    }

    if (success) {
        const isAccepted = success.response === 'accept'
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
                    maxWidth: '500px',
                    width: '100%',
                    padding: 'var(--space-2xl)',
                    backgroundColor: 'white',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: isAccepted ? 'var(--success-light)' : 'var(--error-light)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-lg)'
                    }}>
                        {isAccepted ? (
                            <CheckCircle size={40} color="var(--success)" />
                        ) : (
                            <XCircle size={40} color="var(--error)" />
                        )}
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>
                        {isAccepted ? 'Presença Confirmada!' : 'Convite Recusado'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        {isAccepted
                            ? `Você confirmou presença na reunião "${success.meeting_title}".`
                            : `Você recusou o convite para a reunião "${success.meeting_title}".`
                        }
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        O organizador será notificado sobre sua resposta.
                    </p>
                </div>
            </div>
        )
    }

    // Mostrar informações e botões de confirmação
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
                maxWidth: '500px',
                width: '100%',
                padding: 'var(--space-2xl)',
                backgroundColor: 'white'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
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
                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Convite para Reunião</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Confirme sua participação
                    </p>
                </div>

                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-lg)',
                    marginBottom: 'var(--space-xl)'
                }}>
                    <h3 style={{ marginBottom: 'var(--space-md)', color: 'var(--text-primary)' }}>
                        {meetingInfo.meeting_title}
                    </h3>

                    <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                        <Calendar size={16} />
                        <span>{meetingInfo.meeting_date}</span>
                    </div>

                    <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                        <Clock size={16} />
                        <span>{meetingInfo.meeting_start} - {meetingInfo.meeting_end}</span>
                    </div>

                    <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                        <Building2 size={16} />
                        <span>{meetingInfo.room_name}</span>
                    </div>

                    <div className="flex items-center gap-sm" style={{ color: 'var(--text-secondary)' }}>
                        <User size={16} />
                        <span>Organizador: {meetingInfo.organizer_name}</span>
                    </div>
                </div>

                <div className="flex gap-md">
                    <button
                        onClick={() => handleResponse('accept')}
                        disabled={submitting}
                        className="btn btn-lg"
                        style={{
                            flex: 1,
                            background: 'var(--success)',
                            color: 'white',
                            border: 'none'
                        }}
                    >
                        {submitting ? (
                            <Loader size={18} className="animate-spin" />
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                Aceitar
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => handleResponse('decline')}
                        disabled={submitting}
                        className="btn btn-lg"
                        style={{
                            flex: 1,
                            background: 'var(--error)',
                            color: 'white',
                            border: 'none'
                        }}
                    >
                        {submitting ? (
                            <Loader size={18} className="animate-spin" />
                        ) : (
                            <>
                                <XCircle size={18} />
                                Recusar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MeetingResponse

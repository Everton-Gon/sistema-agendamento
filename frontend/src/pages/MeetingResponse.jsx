/**
 * =============================================================
 *   MeetingResponse.jsx — Resposta a convite de reunião
 * =============================================================
 *   Responsável por:
 *   - Processar links de convite recebidos por email
 *   - Exibir detalhes da reunião (título, data, sala, organizador)
 *   - Permitir ao participante Aceitar ou Recusar o convite
 *   - Enviar a resposta automaticamente se ?response= está na URL
 *   
 *   URL esperada:
 *   /meeting-response?token=abc123            → mostra botões
 *   /meeting-response?token=abc123&response=accept  → aceita direto
 *   /meeting-response?token=abc123&response=decline → recusa direto
 *   
 *   Estados possíveis:
 *   1. Loading → carregando informações da reunião
 *   2. Erro → token inválido ou expirado
 *   3. Sucesso → resposta registrada (aceita ou recusada)
 *   4. Formulário → mostra detalhes + botões Aceitar/Recusar
 *   
 *   IMPORTANTE:
 *   - Usa fetch nativo (não axios) para evitar interceptor de auth
 *   - Não requer autenticação — link público com token
 * =============================================================
 */

import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Calendar, Clock, Building2, User, AlertCircle, Loader } from 'lucide-react'

// URL base do backend (para chamadas diretas com fetch)
const API_BASE = 'https://backend.malloryapp.com.br'

function MeetingResponse() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')       // Token único do convite
    const response = searchParams.get('response') // Resposta automática (se presente)

    // === Estados ===
    const [loading, setLoading] = useState(true)       // Carregando informações?
    const [submitting, setSubmitting] = useState(false) // Enviando resposta?
    const [meetingInfo, setMeetingInfo] = useState(null) // Dados da reunião
    const [error, setError] = useState(null)            // Mensagem de erro
    const [success, setSuccess] = useState(null)        // Dados de sucesso

    // Ao montar: valida token e carrega informações da reunião
    useEffect(() => {
        if (!token) {
            setError('Link inválido')
            setLoading(false)
            return
        }
        loadMeetingInfo()
    }, [token])

    // Se ?response= está na URL, envia resposta automaticamente após carregar
    useEffect(() => {
        if (meetingInfo && response && !success) {
            handleResponse(response)
        }
    }, [meetingInfo, response])

    /**
     * Carrega informações da reunião via token.
     * Usa fetch nativo para evitar o interceptor de autenticação do axios.
     * GET /api/meeting-confirmation/respond-info?token=...
     */
    async function loadMeetingInfo() {
        try {
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

    /**
     * Envia a resposta do participante (aceitar/recusar).
     * POST /api/meeting-confirmation/respond?token=...&response=accept|decline
     * Em sucesso, exibe tela de confirmação.
     */
    async function handleResponse(responseType) {
        setSubmitting(true)
        try {
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

    // === ESTADO 1: Carregamento ===
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

    // === ESTADO 2: Erro (token inválido ou expirado) ===
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

    // === ESTADO 3: Resposta registrada com sucesso ===
    if (success) {
        const isAccepted = success.response === 'accept' // true = aceito, false = recusado
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

    // === ESTADO 4: Exibir detalhes da reunião + botões Aceitar/Recusar ===
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

                {/* Botões de ação: Aceitar (verde) / Recusar (vermelho) */}
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

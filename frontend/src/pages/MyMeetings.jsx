/**
 * =============================================================
 *   MyMeetings.jsx — Página de "Minhas Reuniões"
 * =============================================================
 *   Responsável por:
 *   - Listar reuniões locais do usuário (banco de dados)
 *   - Listar reuniões do Outlook/Teams do usuário (Graph API)
 *   - Filtrar por: Próximas, Passadas ou Todas
 *   - Exibir detalhes de cada reunião em modal
 *   - Cancelar reuniões locais (via backend)
 *   - Cancelar reuniões do Outlook (organizador → DELETE /me/events)
 *   - Recusar reuniões do Outlook (participante → POST /me/events/decline)
 *
 *   Filtros:
 *   - "Próximas" → data >= agora
 *   - "Passadas" → data < agora
 *   - "Todas" → sem filtro
 * =============================================================
 */

import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { useAuth } from '../contexts/AuthContext'
import { meetingService } from '../services/meetingService'
import { outlookService } from '../services/outlookService'
import Modal from '../components/Common/Modal'
import { format, addDays, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    Calendar,
    Clock,
    Building2,
    Users,
    Trash2,
    AlertCircle,
    CheckCircle,
    CheckCircle2,
    X,
    UserX,
    RefreshCw,
    Pencil
} from 'lucide-react'

function MyMeetings() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { instance: msalInstance } = useMsal()

    // === Estados de dados e controle de UI ===
    const [meetings, setMeetings] = useState([])                   // Todas as reuniões mescladas
    const [loading, setLoading] = useState(true)                   // Indicador de carregamento
    const [filter, setFilter] = useState('upcoming')               // Filtro ativo: 'upcoming' | 'past' | 'all'
    const [selectedMeeting, setSelectedMeeting] = useState(null)   // Reunião aberta no modal de detalhes
    const [confirmAction, setConfirmAction] = useState(null)       // { meeting, action: 'cancel'|'decline' }
    const [processing, setProcessing] = useState(false)            // Indica operação em andamento
    const [successMessage, setSuccessMessage] = useState(location.state?.success || null) // Mensagem do router
    const [outlookError, setOutlookError] = useState(false)        // Se o Outlook falhou ao carregar

    // Carrega reuniões ao montar o componente
    useEffect(() => {
        loadMeetings()
    }, [])

    // Limpa mensagem de sucesso automaticamente após 5 segundos
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [successMessage])

    /**
     * Busca reuniões locais + Outlook em paralelo e mescla os resultados.
     * Reuniões locais têm source='local', Outlook têm source='outlook'.
     */
    async function loadMeetings() {
        try {
            setLoading(true)
            setOutlookError(false)

            // ── 1. Busca reuniões locais do banco ──
            const localMeetings = await meetingService.getMeetings()
            const normalizedLocal = localMeetings.map(m => ({
                ...m,
                source: m.source || 'local',
                is_organizer: true  // Minhas Reuniões locais são sempre do organizador
            }))

            // ── 2. Busca eventos do Outlook (30 dias passados + 60 dias futuros) ──
            let outlookEvents = []
            try {
                const now = new Date()
                const rangeStart = new Date(now)
                rangeStart.setDate(rangeStart.getDate() - 30) // 30 dias atrás (para "Passadas")
                const rangeEnd = endOfDay(addDays(now, 60))   // 60 dias à frente

                outlookEvents = await outlookService.getUserCalendarEvents(
                    msalInstance,
                    user?.email,
                    rangeStart,
                    rangeEnd,
                    localMeetings  // Para deduplicação
                )
            } catch (outlookErr) {
                console.warn('[MyMeetings] Outlook indisponível:', outlookErr.message)
                setOutlookError(true)
            }

            // ── 3. Mescla e ordena por data de início ──
            const allMeetings = [...normalizedLocal, ...outlookEvents]
                .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))

            setMeetings(allMeetings)
        } catch (error) {
            console.error('Error loading meetings:', error)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Aplica filtro nas reuniões por status temporal.
     * Compara a data da reunião com a data/hora atual.
     */
    const filteredMeetings = meetings.filter(meeting => {
        const meetingDate = new Date(meeting.start_datetime)
        const now = new Date()

        if (filter === 'upcoming') return meetingDate >= now
        if (filter === 'past') return meetingDate < now
        return true  // 'all' → retorna todas
    })

    /**
     * Executa a ação de cancelar ou recusar após confirmação.
     * - Reunião local → chama meetingService.cancelMeeting()
     * - Reunião Outlook + organizador → outlookService.cancelOutlookEvent()
     * - Reunião Outlook + participante → outlookService.declineOutlookEvent()
     */
    const handleConfirmAction = async () => {
        if (!confirmAction) return

        const { meeting, action } = confirmAction
        setProcessing(true)

        try {
            let success = false

            if (meeting.source === 'local') {
                // Cancela reunião local via backend
                await meetingService.cancelMeeting(meeting.id)
                setMeetings(prev => prev.filter(m => m.id !== meeting.id))
                setSuccessMessage('Reunião cancelada com sucesso')
                success = true

            } else if (meeting.source === 'outlook') {
                if (action === 'cancel') {
                    // Cancela evento Outlook (organizador)
                    success = await outlookService.cancelOutlookEvent(
                        msalInstance,
                        meeting.outlook_event_id
                    )
                    if (success) {
                        setMeetings(prev => prev.filter(m => m.outlook_event_id !== meeting.outlook_event_id))
                        setSuccessMessage('Reunião cancelada no Outlook com sucesso')
                    }
                } else if (action === 'decline') {
                    // Recusa evento Outlook (participante)
                    success = await outlookService.declineOutlookEvent(
                        msalInstance,
                        meeting.outlook_event_id
                    )
                    if (success) {
                        setMeetings(prev => prev.filter(m => m.outlook_event_id !== meeting.outlook_event_id))
                        setSuccessMessage('Convite recusado com sucesso')
                    }
                }

                if (!success) {
                    setSuccessMessage('Erro ao processar a ação. Tente novamente.')
                }
            }

            setConfirmAction(null)
            if (selectedMeeting?.outlook_event_id === meeting.outlook_event_id ||
                selectedMeeting?.id === meeting.id) {
                setSelectedMeeting(null)
            }
        } catch (error) {
            console.error('Erro ao processar ação:', error)
        } finally {
            setProcessing(false)
        }
    }

    /**
     * Abre o modal de confirmação correto baseado no tipo de reunião e papel do usuário.
     * - Local → sempre "Cancelar"
     * - Outlook + organizador → "Cancelar" (remove para todos)
     * - Outlook + participante → "Recusar" (remove só do seu calendário)
     */
    const handleActionClick = (e, meeting) => {
        e.stopPropagation()
        const action = (meeting.source === 'outlook' && !meeting.is_organizer)
            ? 'decline'
            : 'cancel'
        setConfirmAction({ meeting, action })
    }

    /** Navega para o formulário de edição com os dados da reunião */
    const handleEditMeeting = (e, meeting) => {
        e.stopPropagation()
        navigate('/new-meeting', {
            state: {
                editMeeting: meeting,
                returnTo: '/my-meetings'
            }
        })
    }

    /**
     * Aceita um convite de reunião do Outlook onde o usuário é PARTICIPANTE.
     * Chama POST /me/events/{eventId}/accept via outlookService.
     */
    const handleAcceptOutlook = async (meeting) => {
        setProcessing(true)
        try {
            const success = await outlookService.acceptOutlookEvent(
                msalInstance,
                meeting.outlook_event_id
            )
            if (success) {
                setSuccessMessage('Convite aceito com sucesso! O organizador foi notificado.')
                setSelectedMeeting(null)
            } else {
                setSuccessMessage('Erro ao aceitar o convite. Tente novamente.')
            }
        } catch (err) {
            console.error('Erro ao aceitar convite:', err)
            setSuccessMessage('Erro ao aceitar o convite. Tente novamente.')
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <div className="spinner spinner-lg" />
            </div>
        )
    }

    // Textos dos badges de papel
    const getRoleBadge = (meeting) => {
        if (meeting.source === 'local') return { label: '👤 Organizador', bg: 'var(--primary-100)', color: 'var(--primary-600)' }
        if (meeting.is_organizer) return { label: '👤 Organizador', bg: 'var(--primary-100)', color: 'var(--primary-600)' }
        return { label: '👥 Participante', bg: 'var(--success-light)', color: '#15803d' }
    }

    // Texto do botão de ação
    const getActionButton = (meeting) => {
        if (meeting.source === 'outlook' && !meeting.is_organizer) {
            return { icon: <UserX size={18} />, title: 'Recusar convite', color: 'var(--warning)' }
        }
        return { icon: <Trash2 size={18} />, title: 'Cancelar reunião', color: 'var(--error)' }
    }

    return (
        <div>
            {/* === MENSAGEM DE SUCESSO === */}
            {successMessage && (
                <div style={{
                    padding: 'var(--space-md)',
                    marginBottom: 'var(--space-lg)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: successMessage.startsWith('Erro')
                        ? 'var(--error-light)'
                        : 'var(--success-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)'
                }}>
                    <div className="flex items-center gap-sm">
                        <CheckCircle size={20} style={{ color: successMessage.startsWith('Erro') ? 'var(--error)' : 'var(--success)' }} />
                        <span style={{ color: successMessage.startsWith('Erro') ? 'var(--error)' : '#15803d' }}>
                            {successMessage}
                        </span>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <X size={16} style={{ color: '#15803d' }} />
                    </button>
                </div>
            )}

            {/* === AVISO: Outlook indisponível === */}
            {outlookError && (
                <div style={{
                    padding: 'var(--space-md)',
                    marginBottom: 'var(--space-lg)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--warning-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)'
                }}>
                    <div className="flex items-center gap-sm">
                        <AlertCircle size={20} style={{ color: '#b45309' }} />
                        <span style={{ color: '#92400e', fontSize: 'var(--font-size-sm)' }}>
                            Não foi possível carregar as reuniões do Outlook. Exibindo apenas as reuniões do sistema.
                        </span>
                    </div>
                    <button
                        onClick={loadMeetings}
                        className="btn btn-ghost btn-sm"
                        title="Tentar novamente"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <h1>Minhas Reuniões</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Gerencie suas reuniões do sistema e do Outlook/Teams
                    </p>
                </div>

                {/* Tabs de filtro: Próximas / Passadas / Todas */}
                <div className="flex gap-sm">
                    {[
                        { key: 'upcoming', label: 'Próximas' },
                        { key: 'past', label: 'Passadas' },
                        { key: 'all', label: 'Todas' }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`btn btn-sm ${filter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* === LISTA DE REUNIÕES ou ESTADO VAZIO === */}
            {filteredMeetings.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Calendar size={64} style={{ color: 'var(--gray-300)', marginBottom: 'var(--space-lg)' }} />
                        <h3 className="empty-state-title">Nenhuma reunião encontrada</h3>
                        <p className="empty-state-description">
                            {filter === 'upcoming'
                                ? 'Você não tem reuniões agendadas. Que tal criar uma?'
                                : filter === 'past'
                                    ? 'Nenhuma reunião passada encontrada.'
                                    : 'Nenhuma reunião cadastrada.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-md">
                    {filteredMeetings.map((meeting, idx) => {
                        const roleBadge = getRoleBadge(meeting)
                        const actionBtn = getActionButton(meeting)

                        return (
                            <div
                                key={meeting.id || meeting.outlook_event_id || idx}
                                className="card"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedMeeting(meeting)}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 'var(--space-lg)',
                                    borderLeft: `4px solid ${meeting.room_color || 'var(--primary-500)'}`
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div className="flex items-center gap-md" style={{ marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                            <h3>{meeting.title}</h3>

                                            {/* Badge sala */}
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: (meeting.room_color || '#6366f1') + '20',
                                                    color: meeting.room_color || '#6366f1'
                                                }}
                                            >
                                                {meeting.room_name}
                                            </span>

                                            {/* Badge papel (Organizador / Participante) */}
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: roleBadge.bg,
                                                    color: roleBadge.color
                                                }}
                                            >
                                                {roleBadge.label}
                                            </span>

                                            {/* Badge Outlook (se veio do Outlook) */}
                                            {meeting.source === 'outlook' && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                                    color: '#6366f1',
                                                    padding: '2px 7px',
                                                    borderRadius: '6px',
                                                    fontWeight: 600,
                                                    letterSpacing: '0.02em'
                                                }}>
                                                    📅 Outlook
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-lg text-sm" style={{ color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                            <span className="flex items-center gap-sm">
                                                <Calendar size={14} />
                                                {format(new Date(meeting.start_datetime), "dd 'de' MMMM", { locale: ptBR })}
                                            </span>
                                            <span className="flex items-center gap-sm">
                                                <Clock size={14} />
                                                {format(new Date(meeting.start_datetime), 'HH:mm')} - {format(new Date(meeting.end_datetime), 'HH:mm')}
                                            </span>
                                            {meeting.attendees?.length > 0 && (
                                                <span className="flex items-center gap-sm">
                                                    <Users size={14} />
                                                    {meeting.attendees.length} participante{meeting.attendees.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Botões de ação: Editar (organizador) + Cancelar/Recusar */}
                                    <div className="flex gap-sm" style={{ flexShrink: 0 }}>
                                        {/* Botão Editar — apenas para organizador de reuniões locais futuras */}
                                        {(meeting.source === 'local' || meeting.is_organizer) &&
                                            new Date(meeting.start_datetime) >= new Date() && (
                                            <button
                                                onClick={(e) => handleEditMeeting(e, meeting)}
                                                className="btn btn-ghost btn-icon"
                                                title="Editar reunião"
                                                style={{ color: 'var(--color-primary, #e07820)' }}
                                            >
                                                <Pencil size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleActionClick(e, meeting)}
                                            className="btn btn-ghost btn-icon"
                                            title={actionBtn.title}
                                            style={{ color: actionBtn.color }}
                                        >
                                            {actionBtn.icon}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* === MODAL: Detalhes da Reunião === */}
            <Modal
                isOpen={!!selectedMeeting}
                onClose={() => setSelectedMeeting(null)}
                title="Detalhes da Reunião"
                size="lg"
                footer={
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px',
                        justifyContent: 'space-between',
                        flexWrap: 'nowrap',
                        width: '100%'
                    }}>
                        {/* Botão Aceitar (apenas para participante de evento Outlook futuro) */}
                        {selectedMeeting &&
                            selectedMeeting.source === 'outlook' &&
                            !selectedMeeting.is_organizer &&
                            new Date(selectedMeeting.start_datetime) >= new Date() && (
                            <button
                                onClick={() => handleAcceptOutlook(selectedMeeting)}
                                disabled={processing}
                                style={{
                                    backgroundColor: '#22c55e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '8px 14px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {processing ? (
                                    <><div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> Aceitando...</>
                                ) : (
                                    <><CheckCircle2 size={15} /> Aceitar</>
                                )}
                            </button>
                        )}

                        {/* Botão Recusar/Cancelar (apenas para eventos futuros) */}
                        {selectedMeeting && new Date(selectedMeeting.start_datetime) >= new Date() && (
                            <button
                                onClick={() => {
                                    const action = (selectedMeeting.source === 'outlook' && !selectedMeeting.is_organizer)
                                        ? 'decline'
                                        : 'cancel'
                                    setConfirmAction({ meeting: selectedMeeting, action })
                                    setSelectedMeeting(null)
                                }}
                                style={{
                                    backgroundColor: selectedMeeting.source === 'outlook' && !selectedMeeting.is_organizer
                                        ? '#f59e0b' : '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '8px 14px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {selectedMeeting.source === 'outlook' && !selectedMeeting.is_organizer
                                    ? <><UserX size={15} /> Recusar</>
                                    : <><Trash2 size={15} /> Cancelar</>
                                }
                            </button>
                        )}
                    </div>
                }
            >
                {selectedMeeting && (
                    <div className="flex flex-col gap-lg">
                        {/* Título + badges */}
                        <div>
                            <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                <h3>{selectedMeeting.title}</h3>
                                {selectedMeeting.source === 'outlook' && (
                                    <span style={{
                                        fontSize: '11px',
                                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                        color: '#6366f1',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 600
                                    }}>
                                        📅 Outlook/Teams
                                    </span>
                                )}
                            </div>
                            <span
                                className="badge"
                                style={{
                                    backgroundColor: (selectedMeeting.room_color || '#6366f1') + '20',
                                    color: selectedMeeting.room_color || '#6366f1'
                                }}
                            >
                                {selectedMeeting.room_name}
                            </span>
                        </div>

                        {/* Descrição */}
                        {selectedMeeting.description && (
                            <div>
                                <h4 style={{ marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)' }}>Descrição</h4>
                                <p>{selectedMeeting.description}</p>
                            </div>
                        )}

                        {/* Data e horário */}
                        <div className="flex flex-col gap-md">
                            <div className="flex items-center gap-md">
                                <Calendar size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p className="font-medium">
                                        {format(new Date(selectedMeeting.start_datetime), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-md">
                                <Clock size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p className="font-medium">
                                        {format(new Date(selectedMeeting.start_datetime), 'HH:mm')} - {format(new Date(selectedMeeting.end_datetime), 'HH:mm')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-md">
                                <Building2 size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p className="font-medium">{selectedMeeting.room_name}</p>
                                </div>
                            </div>
                        </div>

                        {/* Participantes */}
                        {selectedMeeting.attendees?.length > 0 && (
                            <div>
                                <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                                    Participantes ({selectedMeeting.attendees.length})
                                </h4>
                                <div className="flex flex-col gap-sm">
                                    {selectedMeeting.attendees.map((attendee, index) => {
                                        // Normaliza status do Outlook vs local
                                        const statusMap = {
                                            accepted: 'aceito', declined: 'recusado',
                                            tentativelyAccepted: 'pendente', none: 'pendente',
                                            aceito: 'aceito', recusado: 'recusado', pendente: 'pendente'
                                        }
                                        const statusNorm = statusMap[attendee.status] || 'pendente'
                                        return (
                                            <div
                                                key={index}
                                                className="flex items-center gap-sm"
                                                style={{
                                                    padding: 'var(--space-sm)',
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    borderRadius: 'var(--radius-md)'
                                                }}
                                            >
                                                <div className="avatar avatar-sm">
                                                    {(attendee.name || attendee.email)[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{attendee.name || 'Sem nome'}</p>
                                                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                        {attendee.email}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`badge ${statusNorm === 'aceito' ? 'badge-success' :
                                                        statusNorm === 'recusado' ? 'badge-error' : 'badge-warning'
                                                        }`}
                                                    style={{ marginLeft: 'auto' }}
                                                >
                                                    {statusNorm === 'aceito' ? 'Confirmado' :
                                                        statusNorm === 'recusado' ? 'Recusado' : 'Pendente'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Organizador / criado em */}
                        <div style={{
                            padding: 'var(--space-md)',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <strong>Organizador:</strong> {selectedMeeting.organizer_name} ({selectedMeeting.organizer_email})
                            </p>
                            {selectedMeeting.created_at && (
                                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
                                    <strong>Criado em:</strong>{' '}
                                    {format(new Date(selectedMeeting.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                </p>
                            )}
                        </div>

                        {/* Botão Teams */}
                        {selectedMeeting.teams_link && (
                            <div style={{
                                padding: 'var(--space-md)',
                                background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center'
                            }}>
                                <p className="text-sm font-medium" style={{ color: '#4338ca', marginBottom: 'var(--space-sm)' }}>
                                    📹 Reunião Online Disponível
                                </p>
                                <a
                                    href={selectedMeeting.teams_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn"
                                    style={{
                                        background: '#5b5fc7',
                                        color: 'white',
                                        padding: '10px 24px',
                                        borderRadius: 'var(--radius-md)',
                                        textDecoration: 'none',
                                        fontWeight: 'bold',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    🎥 Entrar pelo Teams
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* === MODAL: Confirmação de Cancelar ou Recusar === */}
            <Modal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                title={confirmAction?.action === 'decline' ? 'Recusar Convite' : 'Cancelar Reunião'}
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setConfirmAction(null)}
                            disabled={processing}
                        >
                            Voltar
                        </button>
                        <button
                            className="btn"
                            onClick={handleConfirmAction}
                            disabled={processing}
                            style={{
                                backgroundColor: confirmAction?.action === 'decline' ? '#f59e0b' : 'var(--error)',
                                color: 'white',
                                border: 'none'
                            }}
                        >
                            {processing ? (
                                <>
                                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                    {confirmAction?.action === 'decline' ? 'Recusando...' : 'Cancelando...'}
                                </>
                            ) : (
                                confirmAction?.action === 'decline' ? 'Sim, Recusar' : 'Sim, Cancelar'
                            )}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center gap-md text-center">
                    <div style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: confirmAction?.action === 'decline' ? '#fef3c7' : 'var(--error-light)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {confirmAction?.action === 'decline'
                            ? <UserX size={32} style={{ color: '#f59e0b' }} />
                            : <AlertCircle size={32} style={{ color: 'var(--error)' }} />
                        }
                    </div>
                    <div>
                        <h4 style={{ marginBottom: 'var(--space-sm)' }}>
                            {confirmAction?.action === 'decline'
                                ? 'Tem certeza que deseja recusar este convite?'
                                : 'Tem certeza que deseja cancelar esta reunião?'
                            }
                        </h4>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            {confirmAction?.action === 'decline'
                                ? 'A reunião será removida do seu calendário. O organizador será notificado.'
                                : confirmAction?.meeting?.source === 'outlook'
                                    ? 'O evento será cancelado no Outlook/Teams e todos os participantes serão notificados.'
                                    : 'Esta ação não pode ser desfeita. Todos os participantes serão notificados.'
                            }
                        </p>
                    </div>
                    {confirmAction?.meeting && (
                        <div style={{
                            padding: 'var(--space-md)',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            width: '100%',
                            textAlign: 'left'
                        }}>
                            {confirmAction.meeting.source === 'outlook' && (
                                <span style={{
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                    color: '#6366f1',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    marginBottom: '6px',
                                    display: 'inline-block'
                                }}>
                                    📅 Outlook
                                </span>
                            )}
                            <p className="font-medium">{confirmAction.meeting.title}</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {format(new Date(confirmAction.meeting.start_datetime), "dd/MM/yyyy 'às' HH:mm")} - {confirmAction.meeting.room_name}
                            </p>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}

export default MyMeetings

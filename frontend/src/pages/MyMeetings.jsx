import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { meetingService } from '../services/meetingService'
import Modal from '../components/Common/Modal'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    Calendar,
    Clock,
    Building2,
    Users,
    Trash2,
    AlertCircle,
    CheckCircle,
    X
} from 'lucide-react'

function MyMeetings() {
    const location = useLocation()
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('upcoming') // 'upcoming', 'past', 'all'
    const [selectedMeeting, setSelectedMeeting] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [successMessage, setSuccessMessage] = useState(location.state?.success || null)

    useEffect(() => {
        loadMeetings()
    }, [])

    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [successMessage])

    async function loadMeetings() {
        try {
            setLoading(true)
            const meetingsData = await meetingService.getMeetings()
            setMeetings(meetingsData)
        } catch (error) {
            console.error('Error loading meetings:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredMeetings = meetings.filter(meeting => {
        const meetingDate = new Date(meeting.start_datetime)
        const now = new Date()

        if (filter === 'upcoming') return meetingDate >= now
        if (filter === 'past') return meetingDate < now
        return true
    })

    const handleCancelMeeting = async () => {
        if (!confirmDelete) return

        setDeleting(true)
        try {
            await meetingService.cancelMeeting(confirmDelete.id)
            setMeetings(prev => prev.filter(m => m.id !== confirmDelete.id))
            setConfirmDelete(null)
            setSuccessMessage('Reunião cancelada com sucesso')
        } catch (error) {
            console.error('Error canceling meeting:', error)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <div className="spinner spinner-lg" />
            </div>
        )
    }

    return (
        <div>
            {/* Success Message */}
            {successMessage && (
                <div style={{
                    padding: 'var(--space-md)',
                    marginBottom: 'var(--space-lg)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--success-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)'
                }}>
                    <div className="flex items-center gap-sm">
                        <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                        <span style={{ color: '#15803d' }}>{successMessage}</span>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <X size={16} style={{ color: '#15803d' }} />
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <h1>Minhas Reuniões</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Gerencie suas reuniões agendadas
                    </p>
                </div>

                {/* Filter Tabs */}
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
                    {filteredMeetings.map(meeting => (
                        <div
                            key={meeting.id}
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
                                        <span
                                            className="badge"
                                            style={{
                                                backgroundColor: meeting.room_color + '20',
                                                color: meeting.room_color
                                            }}
                                        >
                                            {meeting.room_name}
                                        </span>
                                        <span
                                            className="badge"
                                            style={{
                                                backgroundColor: 'var(--primary-100)',
                                                color: 'var(--primary-600)'
                                            }}
                                        >
                                            👤 Organizador
                                        </span>
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

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setConfirmDelete(meeting)
                                    }}
                                    className="btn btn-ghost btn-icon"
                                    title="Cancelar reunião"
                                    style={{ color: 'var(--error)' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Meeting Detail Modal */}
            <Modal
                isOpen={!!selectedMeeting}
                onClose={() => setSelectedMeeting(null)}
                title="Detalhes da Reunião"
                size="lg"
            >
                {selectedMeeting && (
                    <div className="flex flex-col gap-lg">
                        <div>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>{selectedMeeting.title}</h3>
                            <span
                                className="badge"
                                style={{
                                    backgroundColor: selectedMeeting.room_color + '20',
                                    color: selectedMeeting.room_color
                                }}
                            >
                                {selectedMeeting.room_name}
                            </span>
                        </div>

                        {selectedMeeting.description && (
                            <div>
                                <h4 style={{ marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)' }}>Descrição</h4>
                                <p>{selectedMeeting.description}</p>
                            </div>
                        )}

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

                        {selectedMeeting.attendees?.length > 0 && (
                            <div>
                                <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                                    Participantes ({selectedMeeting.attendees.length})
                                </h4>
                                <div className="flex flex-col gap-sm">
                                    {selectedMeeting.attendees.map((attendee, index) => (
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
                                                className={`badge ${attendee.status === 'aceito' ? 'badge-success' :
                                                    attendee.status === 'recusado' ? 'badge-error' : 'badge-warning'
                                                    }`}
                                                style={{ marginLeft: 'auto' }}
                                            >
                                                {attendee.status === 'aceito' ? 'Confirmado' :
                                                    attendee.status === 'recusado' ? 'Recusado' : 'Pendente'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{
                            padding: 'var(--space-md)',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <strong>Organizador:</strong> {selectedMeeting.organizer_name} ({selectedMeeting.organizer_email})
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
                                <strong>Criado em:</strong> {format(new Date(selectedMeeting.created_at), "dd/MM/yyyy 'às' HH:mm")}
                            </p>
                        </div>

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

            {/* Confirm Delete Modal */}
            <Modal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                title="Cancelar Reunião"
                footer={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setConfirmDelete(null)}
                            disabled={deleting}
                        >
                            Voltar
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={handleCancelMeeting}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <>
                                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                    Cancelando...
                                </>
                            ) : (
                                'Sim, Cancelar'
                            )}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center gap-md text-center">
                    <div style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: 'var(--error-light)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <AlertCircle size={32} style={{ color: 'var(--error)' }} />
                    </div>
                    <div>
                        <h4 style={{ marginBottom: 'var(--space-sm)' }}>
                            Tem certeza que deseja cancelar esta reunião?
                        </h4>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Esta ação não pode ser desfeita. Todos os participantes serão notificados.
                        </p>
                    </div>
                    {confirmDelete && (
                        <div style={{
                            padding: 'var(--space-md)',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            width: '100%',
                            textAlign: 'left'
                        }}>
                            <p className="font-medium">{confirmDelete.title}</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {format(new Date(confirmDelete.start_datetime), "dd/MM/yyyy 'às' HH:mm")} - {confirmDelete.room_name}
                            </p>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}

export default MyMeetings

/**
 * =============================================================
 *   Rooms.jsx — Página de visualização de salas de reunião
 * =============================================================
 *   Responsável por:
 *   - Listar todas as salas de reunião disponíveis
 *   - Exibir informações: nome, capacidade, recursos, cor
 *   - Mostrar agenda do dia selecionado para cada sala
 *   - Calcular e exibir HORÁRIOS DISPONÍVEIS entre reuniões
 *   - Indicar se a sala está livre ou ocupada AGORA (badge)
 *   - Permitir trocar a data para ver agenda de outro dia
 *   - Animações interativas de hover nos cards
 *   - Clicar em horário disponível → Agendar Reunião (pré-preenchido)
 * =============================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomService } from '../services/roomService'
import { meetingService } from '../services/meetingService'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    Building2,
    Users,
    Tv,
    Camera,
    Presentation,
    Clock,
    CheckCircle,
    XCircle,
    Plus,
    ArrowRight,
    Filter
} from 'lucide-react'

/**
 * Horário de expediente padrão para cálculo de disponibilidade.
 */
const EXPEDIENTE_INICIO = 7
const EXPEDIENTE_FIM = 22

/**
 * Calcula os horários DISPONÍVEIS de uma sala em um dia específico.
 */
function getAvailableSlots(meetings, dateStr) {
    const baseDate = new Date(dateStr + 'T00:00:00')
    const expStart = new Date(baseDate)
    expStart.setHours(EXPEDIENTE_INICIO, 0, 0, 0)
    const expEnd = new Date(baseDate)
    expEnd.setHours(EXPEDIENTE_FIM, 0, 0, 0)

    const sorted = [...meetings].sort(
        (a, b) => new Date(a.start) - new Date(b.start)
    )

    const slots = []
    let cursor = expStart.getTime()

    for (const meeting of sorted) {
        const meetStart = new Date(meeting.start).getTime()
        const meetEnd = new Date(meeting.end).getTime()

        if (meetStart > cursor) {
            slots.push({
                start: format(new Date(cursor), 'HH:mm'),
                end: format(new Date(meetStart), 'HH:mm')
            })
        }

        if (meetEnd > cursor) {
            cursor = meetEnd
        }
    }

    if (cursor < expEnd.getTime()) {
        slots.push({
            start: format(new Date(cursor), 'HH:mm'),
            end: format(expEnd, 'HH:mm')
        })
    }

    return slots
}

function Rooms() {
    const navigate = useNavigate()
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [roomSchedules, setRoomSchedules] = useState({})
    const [loadingSchedules, setLoadingSchedules] = useState(false)
    const [hoveredRoom, setHoveredRoom] = useState(null)
    const [hoveredSlot, setHoveredSlot] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')  // 'all' | 'free' | 'busy'

    useEffect(() => {
        loadRooms()
    }, [])

    useEffect(() => {
        if (rooms.length > 0) {
            loadAllSchedules()
        }
    }, [rooms, selectedDate])

    async function loadRooms() {
        try {
            const roomsData = await roomService.getRooms()
            setRooms(roomsData)
        } catch (error) {
            console.error('Error loading rooms:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadAllSchedules() {
        setLoadingSchedules(true)
        try {
            // PARALELO: busca a agenda de todas as salas ao mesmo tempo
            // Antes: sala1 → aguarda → sala2 → aguarda → sala3 (soma dos tempos)
            // Agora: sala1 + sala2 + sala3 simultâneas (tempo da mais lenta)
            const results = await Promise.all(
                rooms.map(room =>
                    meetingService.getRoomSchedule(room.id, new Date(selectedDate + 'T12:00:00'))
                        .then(schedule => ({ roomId: room.id, meetings: schedule.meetings }))
                        .catch(() => ({ roomId: room.id, meetings: [] }))  // sala com erro → vazia, não trava as outras
                )
            )

            const schedules = {}
            results.forEach(({ roomId, meetings }) => {
                schedules[roomId] = meetings
            })
            setRoomSchedules(schedules)
        } catch (error) {
            console.error('Error loading schedules:', error)
        } finally {
            setLoadingSchedules(false)
        }
    }

    const getResourceIcon = (resource) => {
        const icons = {
            'TV': Tv,
            'Sistema de Áudio': Tv
        }
        return icons[resource] || Tv
    }

    /** Navega para agendar reunião pré-preenchendo sala, data e horário */
    function handleBookSlot(room, startTime, endTime) {
        navigate('/new-meeting', {
            state: {
                selectedDate: selectedDate,
                selectedRoom: room.id,
                selectedStartTime: startTime,
                selectedEndTime: endTime
            }
        })
    }

    /** Navega para agendar reunião pré-preenchendo apenas a sala e data */
    function handleBookRoom(room) {
        navigate('/new-meeting', {
            state: {
                selectedDate: selectedDate,
                selectedRoom: room.id
            }
        })
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
            {/* === CABEÇALHO === */}
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <h1>Salas de Reunião</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Clique em um horário disponível para agendar rapidamente
                    </p>
                </div>

                <div className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
                    {/* Filtros de status */}
                    <div className="flex gap-sm">
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'busy' ? 'all' : 'busy')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                marginTop:'30px',
                                borderRadius: 'var(--radius-full)',
                                border: statusFilter === 'busy' ? '2px solid #ef4444' : '2px solid transparent',
                                backgroundColor: statusFilter === 'busy' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
                                color: '#ef4444',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                transform: statusFilter === 'busy' ? 'scale(1.05)' : 'scale(1)',
                                boxShadow: statusFilter === 'busy' ? '0 2px 8px rgba(239,68,68,0.25)' : 'none'
                            }}
                        >
                            <XCircle size={14} />
                            Ocupada
                        </button>
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'free' ? 'all' : 'free')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                marginTop:'30px',
                                borderRadius: 'var(--radius-full)',
                                border: statusFilter === 'free' ? '2px solid #22c55e' : '2px solid transparent',
                                backgroundColor: statusFilter === 'free' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.08)',
                                color: '#22c55e',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                transform: statusFilter === 'free' ? 'scale(1.05)' : 'scale(1)',
                                boxShadow: statusFilter === 'free' ? '0 2px 8px rgba(34,197,94,0.25)' : 'none'
                            }}
                        >
                            <CheckCircle size={14} />
                            Livre
                        </button>
                    </div>

                    {/* Seletor de data */}
                    <div className="input-group" style={{ minWidth: '200px' }}>
                        <label className="input-label">Ver agenda de:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="input"
                        />
                    </div>
                </div>

            </div>

            {/* === GRID DE CARDS === */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: 'var(--space-lg)'
            }}>
                {rooms.filter(room => {
                    if (statusFilter === 'all') return true
                    const schedule = roomSchedules[room.id] || []
                    const isAvailableNow = !schedule.some(meeting => {
                        const now = new Date()
                        const start = new Date(meeting.start)
                        const end = new Date(meeting.end)
                        return now >= start && now <= end
                    })
                    // Verifica se a data selecionada é hoje para status em tempo real
                    const isToday = format(new Date(selectedDate + 'T12:00:00'), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    if (!isToday) {
                        // Se não é hoje, filtra por: livre = sem reuniões, ocupada = com reuniões
                        if (statusFilter === 'free') return schedule.length === 0
                        if (statusFilter === 'busy') return schedule.length > 0
                    }
                    if (statusFilter === 'free') return isAvailableNow
                    if (statusFilter === 'busy') return !isAvailableNow
                    return true
                }).map(room => {
                    const schedule = roomSchedules[room.id] || []
                    const availableSlots = getAvailableSlots(schedule, selectedDate)
                    const totalAvailableMinutes = availableSlots.reduce((acc, slot) => {
                        const [sh, sm] = slot.start.split(':').map(Number)
                        const [eh, em] = slot.end.split(':').map(Number)
                        return acc + (eh * 60 + em) - (sh * 60 + sm)
                    }, 0)
                    const totalAvailableHours = Math.floor(totalAvailableMinutes / 60)
                    const totalAvailableMins = totalAvailableMinutes % 60

                    const isAvailableNow = !schedule.some(meeting => {
                        const now = new Date()
                        const start = new Date(meeting.start)
                        const end = new Date(meeting.end)
                        return now >= start && now <= end
                    })

                    const isHovered = hoveredRoom === room.id

                    return (
                        <div
                            key={room.id}
                            className="card"
                            onMouseEnter={() => setHoveredRoom(room.id)}
                            onMouseLeave={() => { setHoveredRoom(null); setHoveredSlot(null) }}
                            style={{
                                overflow: 'hidden',
                                transform: isHovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
                                boxShadow: isHovered
                                    ? `0 20px 40px ${room.color}30, 0 8px 16px rgba(0,0,0,0.1)`
                                    : '0 1px 3px rgba(0,0,0,0.08)',
                                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                        >
                            {/* Header colorido */}
                            <div style={{
                                background: isHovered
                                    ? `linear-gradient(135deg, ${room.color}, ${room.color}bb)`
                                    : `linear-gradient(135deg, ${room.color}cc, ${room.color}99)`,
                                padding: 'var(--space-lg)',
                                color: 'white',
                                transition: 'background 0.3s ease'
                            }}>
                                <div className="flex items-center gap-md">
                                    <div style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-sm)',
                                        transform: isHovered ? 'rotate(-8deg) scale(1.1)' : 'rotate(0) scale(1)',
                                        transition: 'transform 0.3s ease'
                                    }}>
                                        <Building2 size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3>{room.name}</h3>
                                        <p style={{ opacity: 0.9 }}>
                                            <Users size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                            Capacidade: {room.capacity} pessoas
                                        </p>
                                    </div>
                                    {/* Badge "Livre" ou "Ocupada" */}
                                    {format(new Date(selectedDate + 'T12:00:00'), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                                        <span style={{
                                            backgroundColor: isAvailableNow ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                                            padding: 'var(--space-xs) var(--space-sm)',
                                            borderRadius: 'var(--radius-full)',
                                            fontSize: 'var(--font-size-xs)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {isAvailableNow ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                            {isAvailableNow ? 'Livre' : 'Ocupada'}
                                        </span>
                                    )}
                                </div>

                                {/* Botão "Agendar" aparece no hover */}
                                <div style={{
                                    overflow: 'hidden',
                                    maxHeight: isHovered ? '50px' : '0',
                                    opacity: isHovered ? 1 : 0,
                                    transition: 'max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease',
                                    marginTop: isHovered ? 'var(--space-sm)' : '0'
                                }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleBookRoom(room) }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 16px',
                                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                            border: '1px solid rgba(255, 255, 255, 0.4)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'white',
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            transition: 'background-color 0.2s ease',
                                            backdropFilter: 'blur(4px)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.4)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'}
                                    >
                                        <Plus size={16} />
                                        Agendar nesta sala
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="card-body">
                                {/* Recursos */}
                                <div style={{ marginBottom: 'var(--space-lg)' }}>
                                    <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                        Recursos
                                    </h4>
                                    <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                        {room.resources.map(resource => {
                                            const Icon = getResourceIcon(resource)
                                            return (
                                                <span
                                                    key={resource}
                                                    className="badge"
                                                    style={{
                                                        backgroundColor: room.color + '15',
                                                        color: room.color,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Icon size={12} />
                                                    {resource}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Agenda + Horários Disponíveis */}
                                <div>
                                    <h4 style={{
                                        marginBottom: 'var(--space-sm)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--font-size-sm)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span>
                                            Agenda — {format(new Date(selectedDate + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                                        </span>
                                        {!loadingSchedules && (
                                            <span style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: availableSlots.length > 0 ? '#15803d' : 'var(--text-secondary)',
                                                fontWeight: 400
                                            }}>
                                                {totalAvailableHours > 0 && `${totalAvailableHours}h`}
                                                {totalAvailableMins > 0 && `${totalAvailableMins}min`}
                                                {totalAvailableMinutes === 0 ? 'Sem horários' : ' livre'}
                                            </span>
                                        )}
                                    </h4>

                                    {loadingSchedules ? (
                                        <div className="flex items-center gap-sm" style={{ color: 'var(--text-secondary)' }}>
                                            <div className="spinner spinner-sm" />
                                            <span className="text-sm">Carregando...</span>
                                        </div>
                                    ) : schedule.length === 0 ? (
                                        /* Sem reuniões — horário completo livre e clicável */
                                        <div
                                            onClick={() => handleBookRoom(room)}
                                            style={{
                                                padding: 'var(--space-md)',
                                                backgroundColor: hoveredRoom === room.id ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.08)',
                                                borderRadius: 'var(--radius-md)',
                                                borderLeft: '3px solid #22c55e',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                transform: hoveredRoom === room.id ? 'scale(1.01)' : 'scale(1)'
                                            }}
                                        >
                                            <div className="flex items-center gap-sm">
                                                <CheckCircle size={16} style={{ color: '#22c55e' }} />
                                                <span className="text-sm font-medium" style={{ color: '#15803d' }}>
                                                    {String(EXPEDIENTE_INICIO).padStart(2, '0')}:00 — {EXPEDIENTE_FIM}:00
                                                </span>
                                                <span className="text-xs" style={{ color: '#22c55e', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    Disponível
                                                    {isHovered && <ArrowRight size={12} />}
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: '#15803d', opacity: 0.7, marginTop: '4px', marginLeft: '30px' }}>
                                                {isHovered ? 'Clique para agendar' : 'Nenhuma reunião agendada'}
                                            </p>
                                        </div>
                                    ) : (
                                        /* Timeline: reuniões + slots disponíveis */
                                        <div className="flex flex-col gap-sm">
                                            {(() => {
                                                const timeline = []

                                                schedule.forEach(meeting => {
                                                    timeline.push({
                                                        type: 'busy',
                                                        start: format(new Date(meeting.start), 'HH:mm'),
                                                        end: format(new Date(meeting.end), 'HH:mm'),
                                                        title: meeting.title,
                                                        source: meeting.source || 'local',
                                                        organizer_name: meeting.organizer_name,
                                                        sortKey: new Date(meeting.start).getTime()
                                                    })
                                                })

                                                availableSlots.forEach(slot => {
                                                    timeline.push({
                                                        type: 'free',
                                                        start: slot.start,
                                                        end: slot.end,
                                                        sortKey: parseInt(slot.start.replace(':', ''))
                                                    })
                                                })

                                                timeline.sort((a, b) => a.sortKey - b.sortKey)

                                                return timeline.map((item, index) => {
                                                    const slotId = `${room.id}-${index}`
                                                    const isSlotHovered = hoveredSlot === slotId
                                                    const isOutlook = item.source === 'outlook'

                                                    return item.type === 'busy' ? (
                                                        /* Reunião ocupada */
                                                        <div
                                                            key={`busy-${index}`}
                                                            style={{
                                                                padding: 'var(--space-sm) var(--space-md)',
                                                                backgroundColor: isOutlook ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                                                                borderRadius: 'var(--radius-md)',
                                                                borderLeft: `3px solid ${isOutlook ? '#6366f1' : room.color}`,
                                                                opacity: isHovered ? 0.7 : 1,
                                                                transition: 'opacity 0.2s ease'
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-sm">
                                                                <Clock size={14} style={{ color: isOutlook ? '#6366f1' : 'var(--text-secondary)' }} />
                                                                <span className="text-sm font-medium">
                                                                    {item.start} — {item.end}
                                                                </span>
                                                                {isOutlook && (
                                                                    <span style={{
                                                                        fontSize: '10px',
                                                                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                                                        color: '#6366f1',
                                                                        padding: '1px 6px',
                                                                        borderRadius: '8px',
                                                                        fontWeight: 600,
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        📅 Outlook
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm" style={{
                                                                marginTop: '2px',
                                                                color: isOutlook ? '#6366f1' : 'var(--text-secondary)',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {item.title}
                                                            </p>
                                                            {isOutlook && item.organizer_name && (
                                                                <p className="text-xs" style={{ marginTop: '2px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                                                                    Organizado por {item.organizer_name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        /* Slot disponível — clicável */
                                                        <div
                                                            key={`free-${index}`}
                                                            onMouseEnter={() => setHoveredSlot(slotId)}
                                                            onMouseLeave={() => setHoveredSlot(null)}
                                                            onClick={(e) => { e.stopPropagation(); handleBookSlot(room, item.start, item.end) }}
                                                            style={{
                                                                padding: 'var(--space-sm) var(--space-md)',
                                                                backgroundColor: isSlotHovered ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.08)',
                                                                borderRadius: 'var(--radius-md)',
                                                                borderLeft: isSlotHovered ? '3px solid #16a34a' : '3px solid #22c55e',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                transform: isSlotHovered ? 'scale(1.02)' : 'scale(1)',
                                                                boxShadow: isSlotHovered ? '0 2px 8px rgba(34,197,94,0.2)' : 'none'
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-sm">
                                                                <CheckCircle size={14} style={{
                                                                    color: '#22c55e',
                                                                    transform: isSlotHovered ? 'scale(1.2)' : 'scale(1)',
                                                                    transition: 'transform 0.2s ease'
                                                                }} />
                                                                <span className="text-sm font-medium" style={{ color: '#15803d' }}>
                                                                    {item.start} — {item.end}
                                                                </span>
                                                                <span style={{
                                                                    marginLeft: 'auto',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    fontSize: 'var(--font-size-xs)',
                                                                    color: isSlotHovered ? '#16a34a' : '#22c55e',
                                                                    fontWeight: isSlotHovered ? '600' : '400',
                                                                    transition: 'all 0.2s ease'
                                                                }}>
                                                                    {isSlotHovered ? (
                                                                        <>Agendar <ArrowRight size={12} /></>
                                                                    ) : (
                                                                        'Disponível'
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Rooms

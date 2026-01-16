import { useState, useEffect } from 'react'
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
    XCircle
} from 'lucide-react'

function Rooms() {
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [roomSchedules, setRoomSchedules] = useState({})
    const [loadingSchedules, setLoadingSchedules] = useState(false)

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
            const schedules = {}
            for (const room of rooms) {
                const schedule = await meetingService.getRoomSchedule(room.id, new Date(selectedDate))
                schedules[room.id] = schedule.meetings
            }
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
            // 'Webcam': Camera,
            // 'Projetor': Presentation,
            // 'Quadro Branco': Presentation,
            'Sistema de Áudio': Tv
        }
        return icons[resource] || Tv
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
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <h1>Salas de Reunião</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Visualize informações e disponibilidade das salas
                    </p>
                </div>

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

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: 'var(--space-lg)'
            }}>
                {rooms.map(room => {
                    const schedule = roomSchedules[room.id] || []
                    const isAvailableNow = !schedule.some(meeting => {
                        const now = new Date()
                        const start = new Date(meeting.start)
                        const end = new Date(meeting.end)
                        return now >= start && now <= end
                    })

                    return (
                        <div key={room.id} className="card" style={{ overflow: 'hidden' }}>
                            {/* Room Header */}
                            <div style={{
                                background: `linear-gradient(135deg, ${room.color}cc, ${room.color}99)`,
                                padding: 'var(--space-lg)',
                                color: 'white'
                            }}>
                                <div className="flex items-center gap-md">
                                    <div style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-sm)'
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
                                    {format(new Date(selectedDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
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
                            </div>

                            <div className="card-body">
                                {/* Resources */}
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

                                {/* Schedule for Selected Date */}
                                <div>
                                    <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                        Agenda - {format(new Date(selectedDate), "dd 'de' MMMM", { locale: ptBR })}
                                    </h4>

                                    {loadingSchedules ? (
                                        <div className="flex items-center gap-sm" style={{ color: 'var(--text-secondary)' }}>
                                            <div className="spinner spinner-sm" />
                                            <span className="text-sm">Carregando...</span>
                                        </div>
                                    ) : schedule.length === 0 ? (
                                        <div style={{
                                            padding: 'var(--space-md)',
                                            backgroundColor: 'var(--success-light)',
                                            borderRadius: 'var(--radius-md)',
                                            textAlign: 'center'
                                        }}>
                                            <CheckCircle size={20} style={{ color: 'var(--success)', margin: '0 auto var(--space-xs)' }} />
                                            <p className="text-sm" style={{ color: '#15803d' }}>
                                                Sala disponível o dia todo
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-sm">
                                            {schedule.map((meeting, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        padding: 'var(--space-sm) var(--space-md)',
                                                        backgroundColor: 'var(--bg-secondary)',
                                                        borderRadius: 'var(--radius-md)',
                                                        borderLeft: `3px solid ${room.color}`
                                                    }}
                                                >
                                                    <div className="flex items-center gap-sm">
                                                        <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                                        <span className="text-sm font-medium">
                                                            {format(new Date(meeting.start), 'HH:mm')} - {format(new Date(meeting.end), 'HH:mm')}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm" style={{
                                                        marginTop: '2px',
                                                        color: 'var(--text-secondary)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {meeting.title}
                                                    </p>
                                                </div>
                                            ))}
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

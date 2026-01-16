import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Calendar from '../components/Calendar/Calendar'
import Modal from '../components/Common/Modal'
import { meetingService } from '../services/meetingService'
import { roomService } from '../services/roomService'
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, Building2, Users, User, X } from 'lucide-react'

function CalendarPage() {
    const navigate = useNavigate()
    const [events, setEvents] = useState([])
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [currentMonth, setCurrentMonth] = useState(new Date())

    useEffect(() => {
        loadData()
    }, [currentMonth])

    async function loadData() {
        try {
            setLoading(true)
            const start = startOfMonth(currentMonth)
            const end = endOfMonth(addMonths(currentMonth, 1))

            const [eventsData, roomsData] = await Promise.all([
                meetingService.getCalendarEvents(start, end),
                roomService.getRooms()
            ])

            setEvents(eventsData)
            setRooms(roomsData)
        } catch (error) {
            console.error('Error loading calendar data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDayClick = (date) => {
        navigate('/new-meeting', { state: { selectedDate: date } })
    }

    const handleEventClick = (event) => {
        setSelectedEvent(event)
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
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h1>Calendário</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Visualize e gerencie todas as reuniões agendadas
                </p>
            </div>

            <Calendar
                events={events}
                rooms={rooms}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
            />

            {/* Event Detail Modal */}
            <Modal
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                title="Detalhes da Reunião"
                footer={
                    <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>
                        Fechar
                    </button>
                }
            >
                {selectedEvent && (
                    <div className="flex flex-col gap-lg">
                        <div>
                            <h3 style={{ marginBottom: 'var(--space-sm)' }}>{selectedEvent.title}</h3>
                            <span
                                className="badge"
                                style={{
                                    backgroundColor: selectedEvent.room_color + '20',
                                    color: selectedEvent.room_color
                                }}
                            >
                                {selectedEvent.room_name}
                            </span>
                        </div>

                        <div className="flex flex-col gap-md">
                            <div className="flex items-center gap-md">
                                <Clock size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p className="font-medium">
                                        {format(new Date(selectedEvent.start), "EEEE, d 'de' MMMM", { locale: ptBR })}
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)' }}>
                                        {format(new Date(selectedEvent.start), 'HH:mm')} - {format(new Date(selectedEvent.end), 'HH:mm')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-md">
                                <Building2 size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p className="font-medium">{selectedEvent.room_name}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-md">
                                <User size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p className="font-medium">Organizador</p>
                                    <p style={{ color: 'var(--text-secondary)' }}>
                                        {selectedEvent.organizer_name}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {selectedEvent.is_own_meeting && (
                            <div style={{
                                padding: 'var(--space-md)',
                                backgroundColor: 'var(--primary-50)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center'
                            }}>
                                <p className="text-sm" style={{ color: 'var(--primary-700)' }}>
                                    Esta é uma reunião que você organizou
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default CalendarPage

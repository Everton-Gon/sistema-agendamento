import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { meetingService } from '../services/meetingService'
import { roomService } from '../services/roomService'
import {
    Calendar,
    Plus,
    Clock,
    Users,
    Building2,
    ArrowRight,
    CalendarCheck
} from 'lucide-react'
import { format, startOfDay, endOfDay, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function Dashboard() {
    const { user } = useAuth()
    const [todayMeetings, setTodayMeetings] = useState([])
    const [upcomingMeetings, setUpcomingMeetings] = useState([])
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        today: 0,
        week: 0,
        rooms: 6
    })

    useEffect(() => {
        loadDashboardData()
    }, [])

    async function loadDashboardData() {
        try {
            const today = new Date()
            const weekEnd = addDays(today, 7)

            // Usar formato ISO local
            const startStr = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss")
            const endStr = format(endOfDay(weekEnd), "yyyy-MM-dd'T'HH:mm:ss")

            const [meetingsData, roomsData] = await Promise.all([
                meetingService.getMeetings(startStr, endStr),
                roomService.getRooms()
            ])

            const todaysList = meetingsData.filter(m =>
                format(new Date(m.start_datetime), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
            )

            const upcomingList = meetingsData.filter(m =>
                new Date(m.start_datetime) > today
            ).slice(0, 5)

            setTodayMeetings(todaysList)
            setUpcomingMeetings(upcomingList)
            setRooms(roomsData)
            setStats({
                today: todaysList.length,
                week: meetingsData.length,
                rooms: roomsData.length
            })
        } catch (error) {
            console.error('Error loading dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Bom dia'
        if (hour < 18) return 'Boa tarde'
        return 'Boa noite'
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
            {/* Welcome Header */}
            <div style={{ marginBottom: 'var(--space-2xl)' }}>
                <h1 style={{ marginBottom: 'var(--space-xs)' }}>
                    {getGreeting()}, {user?.name?.split(' ')[0]}! 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-lg)' }}>
                    {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
            </div>

            {/* Quick Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--space-lg)',
                marginBottom: 'var(--space-2xl)'
            }}>
                <Link to="/new-meeting" className="card" style={{
                    padding: 'var(--space-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-normal)',
                    background: 'var(--gradient-tertiary)',
                    color: 'white',
                    cursor: 'pointer'
                }}>
                    <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-sm)'
                    }}>
                        <Plus size={24} />
                    </div>
                    <div>
                        <h4>Nova Reunião</h4>
                        <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.9 }}>
                            Agende agora
                        </p>
                    </div>
                </Link>

                <Link to="/calendar" className="card" style={{
                    padding: 'var(--space-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-normal)',
                    cursor: 'pointer'
                }}>
                    <div style={{
                        backgroundColor: 'var(--primary-100)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-sm)',
                        color: 'var(--primary-600)'
                    }}>
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h4 style={{ color: 'var(--text-primary)' }}>Calendário</h4>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            Ver agenda completa
                        </p>
                    </div>
                </Link>

                <Link to="/rooms" className="card" style={{
                    padding: 'var(--space-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-normal)',
                    cursor: 'pointer'
                }}>
                    <div style={{
                        backgroundColor: 'var(--success-light)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-sm)',
                        color: '#15803d'
                    }}>
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h4 style={{ color: 'var(--text-primary)' }}>Salas</h4>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            {stats.rooms} salas disponíveis
                        </p>
                    </div>
                </Link>
            </div>

            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 'var(--space-lg)',
                marginBottom: 'var(--space-2xl)'
            }}>
                <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: 'var(--primary-100)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-sm)',
                        color: 'var(--primary-600)'
                    }}>
                        <CalendarCheck size={24} />
                    </div>
                    <h2 style={{ marginBottom: '4px' }}>{stats.today}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Reuniões hoje
                    </p>
                </div>

                <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: 'var(--warning-light)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-sm)',
                        color: '#b45309'
                    }}>
                        <Clock size={24} />
                    </div>
                    <h2 style={{ marginBottom: '4px' }}>{stats.week}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Esta semana
                    </p>
                </div>

                <div className="card" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: 'var(--success-light)',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-sm)',
                        color: '#15803d'
                    }}>
                        <Building2 size={24} />
                    </div>
                    <h2 style={{ marginBottom: '4px' }}>{stats.rooms}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Salas
                    </p>
                </div>
            </div>

            {/* Today's Meetings & Upcoming */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 'var(--space-lg)'
            }}>
                {/* Today's Meetings */}
                <div className="card">
                    <div className="card-header flex justify-between items-center">
                        <h3>Reuniões de Hoje</h3>
                        <Link to="/my-meetings" className="btn btn-ghost btn-sm">
                            Ver todas <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="card-body">
                        {todayMeetings.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                                <Calendar size={48} style={{ color: 'var(--gray-300)', marginBottom: 'var(--space-md)' }} />
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    Nenhuma reunião agendada para hoje
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-md">
                                {todayMeetings.map(meeting => (
                                    <div key={meeting.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-md)',
                                        padding: 'var(--space-md)',
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        borderLeft: `4px solid ${meeting.room_color || 'var(--primary-500)'}`
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ marginBottom: '4px' }}>{meeting.title}</h4>
                                            <div className="flex gap-md text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="flex items-center gap-sm">
                                                    <Clock size={14} />
                                                    {format(new Date(meeting.start_datetime), 'HH:mm')} - {format(new Date(meeting.end_datetime), 'HH:mm')}
                                                </span>
                                                <span className="flex items-center gap-sm">
                                                    <Building2 size={14} />
                                                    {meeting.room_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Upcoming Meetings */}
                <div className="card">
                    <div className="card-header flex justify-between items-center">
                        <h3>Próximas Reuniões</h3>
                    </div>
                    <div className="card-body">
                        {upcomingMeetings.length === 0 ? (
                            <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                                <Clock size={48} style={{ color: 'var(--gray-300)', marginBottom: 'var(--space-md)' }} />
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    Nenhuma reunião agendada
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-md">
                                {upcomingMeetings.map(meeting => (
                                    <div key={meeting.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-md)',
                                        padding: 'var(--space-md)',
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        borderLeft: `4px solid ${meeting.room_color || 'var(--primary-500)'}`
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ marginBottom: '4px' }}>{meeting.title}</h4>
                                            <div className="flex flex-col gap-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="flex items-center gap-sm">
                                                    <Calendar size={14} />
                                                    {format(new Date(meeting.start_datetime), "dd/MM 'às' HH:mm")}
                                                </span>
                                                <span className="flex items-center gap-sm">
                                                    <Building2 size={14} />
                                                    {meeting.room_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Dashboard

import { useState, useEffect } from 'react'
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function Calendar({ events = [], rooms = [], onDayClick, onEventClick }) {
    const [currentDate, setCurrentDate] = useState(new Date())

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const getEventsForDay = (day) => {
        return events.filter(event =>
            isSameDay(new Date(event.start), day)
        )
    }

    const previousMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const goToToday = () => setCurrentDate(new Date())

    return (
        <div className="calendar-container">
            <div className="calendar-header">
                <div className="calendar-nav">
                    <button className="btn btn-ghost btn-icon" onClick={previousMonth}>
                        <ChevronLeft size={20} />
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={goToToday}>
                        Hoje
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={nextMonth}>
                        <ChevronRight size={20} />
                    </button>
                </div>

                <h2 className="calendar-title">
                    {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </h2>

                <div style={{ width: '120px' }}></div>
            </div>

            <div className="calendar-grid">
                {weekDays.map(day => (
                    <div key={day} className="calendar-day-header">
                        {day}
                    </div>
                ))}

                {days.map((day, index) => {
                    const dayEvents = getEventsForDay(day)
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isDayToday = isToday(day)

                    return (
                        <div
                            key={index}
                            className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isDayToday ? 'today' : ''}`}
                            onClick={() => onDayClick && onDayClick(day)}
                        >
                            <div className={`calendar-day-number ${isDayToday ? '' : ''}`}>
                                {isDayToday ? (
                                    <span style={{
                                        backgroundColor: 'var(--primary-500)',
                                        color: 'white',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {format(day, 'd')}
                                    </span>
                                ) : (
                                    format(day, 'd')
                                )}
                            </div>

                            <div className="calendar-events">
                                {dayEvents.slice(0, 3).map((event, eventIndex) => (
                                    <div
                                        key={eventIndex}
                                        className="calendar-event"
                                        style={{ backgroundColor: event.room_color || '#6366f1' }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onEventClick && onEventClick(event)
                                        }}
                                        title={`${event.title} - ${event.room_name}`}
                                    >
                                        {format(new Date(event.start), 'HH:mm')} {event.title}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs" style={{
                                        color: 'var(--text-secondary)',
                                        paddingLeft: 'var(--space-sm)'
                                    }}>
                                        +{dayEvents.length - 3} mais
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {rooms.length > 0 && (
                <div className="room-legend">
                    {rooms.map(room => (
                        <div key={room.id} className="room-legend-item">
                            <div
                                className="room-legend-color"
                                style={{ backgroundColor: room.color }}
                            />
                            <span>{room.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Calendar

/**
 * Calendar.jsx — Componente de calendário com visões Dia, Semana e Mês
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    isToday
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, RefreshCw, Plus, Search } from 'lucide-react'

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    )
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handler)
        handler()
        return () => window.removeEventListener('resize', handler)
    }, [])
    const isTotem = typeof window !== 'undefined' && window.innerWidth === 800 && window.innerHeight >= 1200
    return isMobile && !isTotem
}

function Calendar({ events = [], rooms = [], onDayClick, onEventClick, onRefresh }) {
    const navigate = useNavigate()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [selectedRoom, setSelectedRoom] = useState(null)
    const [hoveredDay, setHoveredDay] = useState(null)
    const [popoverDay, setPopoverDay] = useState(null)
    const [viewMode, setViewMode] = useState('month') // 'day' | 'week' | 'month'

    // Fecha o popover fixado ao clicar fora do calendário
    useEffect(() => {
        const closePopover = () => setPopoverDay(null)
        window.addEventListener('click', closePopover)
        return () => window.removeEventListener('click', closePopover)
    }, [])

    const isMobile = useIsMobile()

    // ── Cálculos de datas ──────────────────────────────────────────────
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Semana atual
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
    const weekDaysRange = eachDayOfInterval({ start: weekStart, end: weekEnd })

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const weekDaysMobile = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

    // ── Funções auxiliares ─────────────────────────────────────────────
    const getEventsForDay = (day) =>
        events.filter(event => {
            if (!isSameDay(new Date(event.start), day)) return false
            if (selectedRoom && event.room_name !== selectedRoom) return false
            return true
        })

    const previousPeriod = () => {
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1))
        else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1))
        else setCurrentDate(subDays(currentDate, 1))
    }

    const nextPeriod = () => {
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1))
        else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1))
        else setCurrentDate(addDays(currentDate, 1))
    }

    const goToToday = () => setCurrentDate(new Date())

    const handleRefresh = async () => {
        if (!onRefresh || isRefreshing) return
        setIsRefreshing(true)
        try { await onRefresh() } finally {
            setTimeout(() => setIsRefreshing(false), 600)
        }
    }

    const getPeriodTitle = () => {
        if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR })
        if (viewMode === 'week') {
            const s = format(weekStart, "d 'de' MMM", { locale: ptBR })
            const e = format(weekEnd, "d 'de' MMM", { locale: ptBR })
            return `${s} — ${e}`
        }
        return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
    }

    // ── Grade de Horários (Dia / Semana) ───────────────────────────────
    const SLOT_HEIGHT = 60
    const GRID_START = 7
    const GRID_END = 21
    const timeSlotHours = Array.from({ length: GRID_END - GRID_START + 1 }, (_, i) => i + GRID_START)

    const getEventTop = (event) => {
        const s = new Date(event.start)
        return Math.max(0, (s.getHours() + s.getMinutes() / 60 - GRID_START) * SLOT_HEIGHT)
    }

    const getEventHeight = (event) => {
        const diff = (new Date(event.end) - new Date(event.start)) / (1000 * 60 * 60)
        return Math.max(24, diff * SLOT_HEIGHT - 2)
    }

    // ── Spin CSS ───────────────────────────────────────────────────────
    const spinStyle = (
        <style>{`
            @keyframes spin-refresh { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            .refreshing { animation: spin-refresh 0.8s linear infinite; }
            .calendar-day-popover-actions {
                display: flex;
                gap: 8px;
                padding: 8px;
                border-top: 1px solid var(--border-color);
                background: var(--bg-secondary, #f9fafb);
            }
            .btn-popover-action {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 7px 8px;
                font-size: 12px;
                font-weight: 600;
                border-radius: var(--radius-sm, 6px);
                cursor: pointer;
                border: 1px solid var(--border-color);
                background: white;
                color: var(--text-primary);
                transition: all 0.15s;
            }
            .btn-popover-action.primary {
                background: var(--primary-500, #6366f1);
                color: white;
                border-color: var(--primary-600, #4f46e5);
            }
            .btn-popover-action:hover {
                filter: brightness(0.95);
                transform: translateY(-1px);
            }
            .calendar-day-popover {
                top: 100%;
                bottom: auto;
            }
            .calendar-day-popover.popover-top {
                top: auto;
                bottom: 100%;
            }
        `}</style>
    )

    // ── Header ─────────────────────────────────────────────────────────
    const Header = () => (
        <div className="calendar-header">
            <div className="calendar-nav">
                <button className="btn btn-ghost btn-icon" onClick={previousPeriod}>
                    <ChevronLeft size={20} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={goToToday}>Hoje</button>
                <button className="btn btn-ghost btn-icon" onClick={nextPeriod}>
                    <ChevronRight size={20} />
                </button>
                {onRefresh && (
                    <button className="btn btn-ghost btn-icon" onClick={handleRefresh}
                        title="Atualizar calendário" style={{ marginLeft: '4px' }}>
                        <RefreshCw size={18} className={isRefreshing ? 'refreshing' : ''}
                            style={{ color: isRefreshing ? 'var(--primary-500)' : undefined }} />
                    </button>
                )}
            </div>

            <h2 className="calendar-title">{getPeriodTitle()}</h2>

            {/* Seletor de visualização — grupo de botões */}
            <div className="view-group hide-mobile">
                <button
                    className={`btn-view ${viewMode === 'day' ? 'active' : ''}`}
                    onClick={() => setViewMode('day')}
                >
                    Dia
                </button>
                <button
                    className={`btn-view ${viewMode === 'week' ? 'active' : ''}`}
                    onClick={() => setViewMode('week')}
                >
                    Semana
                </button>
                <button
                    className={`btn-view ${viewMode === 'month' ? 'active' : ''}`}
                    onClick={() => setViewMode('month')}
                >
                    Mês
                </button>
            </div>
        </div>
    )

    // ── Legenda ────────────────────────────────────────────────────────
    const Legend = () =>
        rooms.length > 0 ? (
            <div className="room-legend">
                {rooms.map(room => {
                    const isSelected = selectedRoom === room.name
                    const isFiltered = selectedRoom && !isSelected
                    return (
                        <div key={room.id}
                            className={`room-legend-item ${isSelected ? 'active' : ''}`}
                            onClick={() => setSelectedRoom(isSelected ? null : room.name)}
                            style={{
                                cursor: 'pointer', opacity: isFiltered ? 0.4 : 1,
                                transition: 'all 0.2s ease', padding: '4px 8px',
                                borderRadius: 'var(--radius-md)',
                                border: isSelected ? `2px solid ${room.color}` : '2px solid transparent',
                                backgroundColor: isSelected ? `${room.color}15` : 'transparent'
                            }}>
                            <div className="room-legend-color" style={{ backgroundColor: room.color }} />
                            <span>{room.name}</span>
                        </div>
                    )
                })}
            </div>
        ) : null

    // ═══════════════════════════════════════════════════════════════════
    //  VISÃO MOBILE
    // ═══════════════════════════════════════════════════════════════════
    if (isMobile) {
        const daysWithEvents = monthDays.filter(day => getEventsForDay(day).length > 0)
        return (
            <div className="calendar-container">
                {spinStyle}
                <Header />
                <div className="calendar-mini-grid">
                    {weekDaysMobile.map((d, i) => (
                        <div key={i} className="calendar-mini-header">{d}</div>
                    ))}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="calendar-mini-day empty" />
                    ))}
                    {monthDays.map((day, index) => {
                        const hasEvents = getEventsForDay(day).length > 0
                        const isDayToday = isToday(day)
                        return (
                            <div key={index}
                                className={`calendar-mini-day ${isDayToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
                                onClick={() => onDayClick && onDayClick(day)}>
                                <span className="calendar-mini-day-number">{format(day, 'd')}</span>
                                {hasEvents && <span className="calendar-mini-dot" />}
                            </div>
                        )
                    })}
                </div>
                <Legend />
                <div className="calendar-agenda">
                    {daysWithEvents.length === 0 ? (
                        <div className="calendar-agenda-empty">Nenhuma reunião este mês</div>
                    ) : (
                        daysWithEvents.map((day, dayIndex) => {
                            const dayEvents = getEventsForDay(day)
                            const isDayToday = isToday(day)
                            return (
                                <div key={dayIndex} className="calendar-agenda-day">
                                    <div className={`calendar-agenda-day-header ${isDayToday ? 'today' : ''}`}
                                        onClick={() => onDayClick && onDayClick(day)}>
                                        <span className="calendar-agenda-day-number">{format(day, 'd')}</span>
                                        <span className="calendar-agenda-day-name">
                                            {format(day, 'EEEE', { locale: ptBR })}
                                        </span>
                                    </div>
                                    <div className="calendar-agenda-events">
                                        {dayEvents.map((event, eventIndex) => (
                                            <div key={eventIndex} className="calendar-agenda-event"
                                                onClick={() => onEventClick && onEventClick(event)}>
                                                <div className="calendar-agenda-event-bar"
                                                    style={{ backgroundColor: event.room_color || '#6366f1' }} />
                                                <div className="calendar-agenda-event-info">
                                                    <div className="calendar-agenda-event-time">
                                                        {event.teams_link && <span>🎥 </span>}
                                                        {format(new Date(event.start), 'HH:mm')}
                                                        {' — '}
                                                        {format(new Date(event.end), 'HH:mm')}
                                                        {event.source === 'outlook' && (
                                                            <span style={{
                                                                fontSize: '9px', backgroundColor: 'rgba(99,102,241,0.15)',
                                                                color: '#6366f1', padding: '1px 5px',
                                                                borderRadius: '6px', fontWeight: 600, marginLeft: '6px'
                                                            }}>📅 Outlook</span>
                                                        )}
                                                    </div>
                                                    <div className="calendar-agenda-event-title">{event.title}</div>
                                                    <div className="calendar-agenda-event-room">{event.room_name}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════
    //  LÓGICA DE COLUNAS: Detecta reuniões sobrepostas e distribui lado a lado
    // ═══════════════════════════════════════════════════════════════════
    const getPositionedEvents = (dayEvents) => {
        const sorted = [...dayEvents].sort(
            (a, b) => new Date(a.start) - new Date(b.start)
        );

        const clusters = [];

        sorted.forEach(event => {
            const start = new Date(event.start);
            const end   = new Date(event.end);
            const target = clusters.find(c =>
                c.some(e => start < new Date(e.end) && end > new Date(e.start))
            );
            if (target) target.push(event);
            else clusters.push([event]);
        });

        const result = [];

        clusters.forEach(cluster => {
            const columns = [];
            const colMap = new Map(); // chave = referência original do objeto

            cluster.forEach(event => {
                const eStart = new Date(event.start);
                const eEnd   = new Date(event.end);

                let colIndex = columns.findIndex(col =>
                    col.every(e => eStart >= new Date(e.end) || eEnd <= new Date(e.start))
                );

                if (colIndex === -1) {
                    columns.push([event]);
                    colIndex = columns.length - 1;
                } else {
                    columns[colIndex].push(event);
                }

                colMap.set(event, colIndex); // ✅ referência original como chave
            });

            const totalCols = columns.length;

            cluster.forEach(event => {
                result.push({
                    ...event,
                    colIndex: colMap.get(event), // ✅ busca pela referência original
                    totalCols,                   // ✅ valor final sem necessidade de correção
                });
            });
        });

        return result;
    };

    // ═══════════════════════════════════════════════════════════════════
    //  VISÃO DIA / SEMANA: Grade de horários vertical
    // ═══════════════════════════════════════════════════════════════════
    if (viewMode === 'week' || viewMode === 'day') {
        const daysToShow = viewMode === 'day' ? [currentDate] : weekDaysRange
        return (
            <div className="calendar-container">
                {spinStyle}
                <Header />
                <div className="time-grid-wrapper">
                    {/* Coluna de horas */}
                    <div className="time-grid-hours-col">
                        <div className="time-grid-hours-top-spacer" />
                        {timeSlotHours.map(hour => (
                            <div key={hour} className="time-grid-hour-label">
                                {String(hour).padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>

                    {/* Área dos dias */}
                    <div className="time-grid-days-area">
                        {/* Cabeçalhos dos dias */}
                        <div className="time-grid-days-header-row"
                            style={{ gridTemplateColumns: `repeat(${daysToShow.length}, 1fr)` }}>
                            {daysToShow.map((day, i) => (
                                <div key={i} className={`time-grid-day-header ${isToday(day) ? 'today' : ''}`}>
                                    <span className="time-grid-day-name">
                                        {format(day, 'EEE', { locale: ptBR })}
                                    </span>
                                    <span className={`time-grid-day-number ${isToday(day) ? 'today' : ''}`}>
                                        {format(day, 'd')}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Grade com eventos */}
                        <div className="time-grid-columns"
                            style={{ gridTemplateColumns: `repeat(${daysToShow.length}, 1fr)` }}>
                            {daysToShow.map((day, dayIndex) => {
                                const dayEvents = getEventsForDay(day)
                                return (
                                    <div key={dayIndex} className="time-grid-day-column"
                                        style={{ height: `${(GRID_END - GRID_START + 1) * SLOT_HEIGHT}px` }}
                                        onClick={() => onDayClick && onDayClick(day)}>
                                        {/* Linhas de hora */}
                                        {timeSlotHours.map(hour => (
                                            <div key={hour} className="time-slot-line"
                                                style={{ top: `${(hour - GRID_START) * SLOT_HEIGHT}px` }} />
                                        ))}
                                        {/* Eventos com layout de colunas lado a lado */}
                                        {getPositionedEvents(
                                            dayEvents.filter(e => {
                                                const h = new Date(e.start).getHours();
                                                return h >= GRID_START && h <= GRID_END;
                                            })
                                        ).map((event, ei) => {
                                            const width = 100 / event.totalCols;
                                            const left  = event.colIndex * width;
                                            return (
                                                <div
                                                    key={ei}
                                                    className="time-grid-event"
                                                    style={{
                                                        top:             `${getEventTop(event)}px`,
                                                        height:          `${getEventHeight(event)}px`,
                                                        backgroundColor: event.room_color || '#6366f1',
                                                        width:           `calc(${width}% - 4px)`,
                                                        left:            `${left}%`,
                                                        zIndex:          event.colIndex + 1,
                                                        borderRight:     event.totalCols > 1
                                                            ? '1px solid rgba(255,255,255,0.3)'
                                                            : 'none',
                                                    }}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        onEventClick && onEventClick(event);
                                                    }}
                                                    title={`${event.title}\nSala: ${event.room_name}\nOrganizado por: ${event.organizer_name || 'Desconhecido'}`}
                                                >
                                                    <span className="time-grid-event-time">
                                                        {event.teams_link && '🎥 '}
                                                        {format(new Date(event.start), 'HH:mm')}
                                                    </span>
                                                    <span
                                                        className="time-grid-event-title"
                                                        style={{ fontSize: event.totalCols > 2 ? '10px' : '11px' }}
                                                    >
                                                        {event.title}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <Legend />
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISÃO MÊS: Grade mensal tradicional
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div className="calendar-container">
            {spinStyle}
            <Header />
            <div className="calendar-grid">
                {weekDays.map(day => (
                    <div key={day} className="calendar-day-header">{day}</div>
                ))}
                {days.map((day, index) => {
                    const dayEvents = getEventsForDay(day)
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isDayToday = isToday(day)
                    // Calcula em qual linha da grade este dia está (0-based)
                    const rowIndex = Math.floor(index / 7)
                    const totalRows = Math.ceil(days.length / 7)
                    const isLastTwoRows = rowIndex >= totalRows - 2
                    return (
                        <div key={index}
                            className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isDayToday ? 'today' : ''}`}
                            onMouseEnter={() => setHoveredDay(index)}
                            onMouseLeave={() => setHoveredDay(null)}
                            onClick={(e) => {
                                e.stopPropagation()
                                setPopoverDay(popoverDay === index ? null : index)
                            }}
                            style={{ position: 'relative', cursor: 'pointer' }}>
                            <div className="calendar-day-number">
                                {isDayToday ? (
                                    <span style={{
                                        backgroundColor: 'var(--primary-500)', color: 'white',
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>{format(day, 'd')}</span>
                                ) : format(day, 'd')}
                            </div>
                            <div className="calendar-events">
                                {dayEvents.slice(0, 3).map((event, eventIndex) => (
                                    <div key={eventIndex} className="calendar-event"
                                        style={{ backgroundColor: event.room_color || '#6366f1' }}
                                        onClick={(e) => { e.stopPropagation(); onEventClick && onEventClick(event) }}
                                        title={`${event.title} - ${event.room_name}`}>
                                        {event.teams_link && <span style={{ marginRight: '4px' }}>🎥</span>}
                                        {event.source === 'outlook' && <span style={{ marginRight: '3px' }}>📅</span>}
                                        {format(new Date(event.start), 'HH:mm')} {event.title}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)', paddingLeft: 'var(--space-sm)' }}>
                                        +{dayEvents.length - 3} mais
                                    </div>
                                )}
                            </div>
                            {(hoveredDay === index || popoverDay === index) && (
                                <div
                                    className={`calendar-day-popover ${isLastTwoRows ? 'popover-top' : ''}`}
                                    onClick={e => e.stopPropagation()}>
                                    <div className="calendar-day-popover-header">
                                        {format(day, "d 'de' MMMM", { locale: ptBR })}
                                        <span className="calendar-day-popover-count">
                                            {dayEvents.length} {dayEvents.length === 1 ? 'reunião' : 'reuniões'}
                                        </span>
                                    </div>
                                    {dayEvents.length > 0 && (
                                        <div className="calendar-day-popover-events">
                                            {dayEvents.map((event, eventIndex) => (
                                                <div key={eventIndex} className="calendar-day-popover-event"
                                                    onClick={(e) => { e.stopPropagation(); onEventClick && onEventClick(event) }}>
                                                    <div className="calendar-day-popover-dot"
                                                        style={{ backgroundColor: event.room_color || '#6366f1' }} />
                                                    <div className="calendar-day-popover-event-info">
                                                        <span className="calendar-day-popover-time">
                                                            {event.teams_link && '🎥 '}
                                                            {format(new Date(event.start), 'HH:mm')} — {format(new Date(event.end), 'HH:mm')}
                                                        </span>
                                                        <span className="calendar-day-popover-title">{event.title}</span>
                                                        <span className="calendar-day-popover-room">
                                                            {event.room_name}
                                                            {event.source === 'outlook' && (
                                                                <span style={{
                                                                    fontSize: '9px', backgroundColor: 'rgba(99,102,241,0.15)',
                                                                    color: '#6366f1', padding: '1px 5px',
                                                                    borderRadius: '6px', fontWeight: 600, marginLeft: '6px'
                                                                }}>📅 Outlook</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Botões aparecem apenas quando fixado por clique */}
                                    {popoverDay === index && (
                                        <div className="calendar-day-popover-actions">
                                            <button
                                                className="btn-popover-action primary"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setPopoverDay(null)
                                                    navigate(`/new-meeting?date=${format(day, 'yyyy-MM-dd')}`)
                                                }}
                                            >
                                                <Plus size={14} /> Agendar
                                            </button>
                                            <button
                                                className="btn-popover-action"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setPopoverDay(null)
                                                    setCurrentDate(day)
                                                    setViewMode('day')
                                                }}
                                            >
                                                <Search size={14} /> Ver detalhes
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            <Legend />
        </div>
    )
}

export default Calendar

/**
 * =============================================================
 *   Calendar.jsx — Componente de calendário mensal
 * =============================================================
 *   Responsável por:
 *   - Renderizar grade de calendário mensal (dom-sáb) no desktop
 *   - Renderizar visão de AGENDA no mobile (< 768px)
 *   - Navegar entre meses (anterior/próximo/hoje)
 *   - Exibir eventos nas células dos dias com cores das salas
 *   - Destacar o dia atual com bolinha colorida
 *   - Mostrar até 3 eventos por dia (+N mais) no desktop
 *   - Exibir legenda de cores das salas
 *   - Ícone de câmera (🎥) para reuniões com link do Teams
 *   
 *   Props:
 *   - events: array de eventos { start, end, title, room_name, room_color, teams_link }
 *   - rooms: array de salas para legenda { id, name, color }
 *   - onDayClick: callback ao clicar em um dia
 *   - onEventClick: callback ao clicar em um evento
 *   
 *   Comportamento responsivo:
 *   - Desktop (≥ 768px): grade mensal tradicional com 7 colunas
 *   - Mobile  (< 768px): mini-grid compacto + lista de agenda por dia
 *     (similar ao calendário nativo de smartphones)
 *   
 *   Usa date-fns para manipulação de datas e formatação em pt-BR.
 * =============================================================
 */

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
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

/**
 * Hook para detectar se a tela é mobile (< 768px).
 * Escuta o evento 'resize' da janela para reagir dinamicamente.
 * 
 * Como funciona:
 * 1. Inicializa com o tamanho atual da janela
 * 2. Registra listener no resize para atualizar o estado
 * 3. Limpa o listener ao desmontar o componente
 * 
 * @returns {boolean} true se a largura da janela < 768px
 */
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    )
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handler)
        // Chama imediatamente para garantir valor correto na montagem
        handler()
        return () => window.removeEventListener('resize', handler)
    }, [])
    return isMobile
}

/**
 * Calendar — Exibe um calendário mensal interativo com eventos.
 * 
 * No MOBILE exibe:
 *   1. Mini-grid compacto com números dos dias (como calendário nativo)
 *   2. Lista de agenda abaixo com eventos agrupados por dia
 * 
 * No DESKTOP exibe:
 *   Grade mensal tradicional com eventos dentro das células
 */
function Calendar({ events = [], rooms = [], onDayClick, onEventClick, onRefresh }) {
    // Data do mês/ano sendo exibido (navega entre meses)
    const [currentDate, setCurrentDate] = useState(new Date())

    // Animação do botão de atualizar (gira enquanto carrega)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Sala selecionada para filtro (null = todas as salas)
    // Clicar na legenda ativa o filtro, clicar de novo desativa (toggle)
    const [selectedRoom, setSelectedRoom] = useState(null)

    // Dia sobre o qual o mouse está posicionado (para exibir o popover no desktop)
    // Armazena o índice do dia no array `days` (null = nenhum popover visível)
    const [hoveredDay, setHoveredDay] = useState(null)

    // Detecta se estamos em mobile para trocar a visão
    const isMobile = useIsMobile()

    // ─── Cálculos de datas ──────────────────────────────────────────────

    // Intervalo completo do mês atual
    const monthStart = startOfMonth(currentDate)          // 1º dia do mês
    const monthEnd = endOfMonth(currentDate)              // Último dia do mês

    // Intervalo expandido para preencher a grade (dom-sáb completo)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })  // Domingo anterior ao 1º dia
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })        // Sábado após último dia

    // Array com todos os dias da grade desktop (inclui dias de meses adjacentes)
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    // Array apenas com dias do mês atual (para a visão agenda mobile)
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Cabeçalho dos dias da semana
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']          // Desktop: abreviado
    const weekDaysMobile = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']                   // Mobile: letra única

    // ─── Funções auxiliares ─────────────────────────────────────────────

    /**
     * Filtra os eventos que ocorrem em um dia específico.
     * Compara apenas a data (ignora horário) usando isSameDay.
     * Se houver uma sala selecionada, filtra também por sala.
     */
    const getEventsForDay = (day) =>
        events.filter(event => {
            // Verifica se o evento é neste dia
            if (!isSameDay(new Date(event.start), day)) return false
            // Se tem sala selecionada, filtra por nome da sala
            if (selectedRoom && event.room_name !== selectedRoom) return false
            return true
        })

    // Navegação entre meses
    const previousMonth = () => setCurrentDate(subMonths(currentDate, 1))  // ← Mês anterior
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))       // → Próximo mês
    const goToToday = () => setCurrentDate(new Date())                       // ● Volta para hoje

    /** Botão Atualizar — recarrega dados com animação de spin */
    const handleRefresh = async () => {
        if (!onRefresh || isRefreshing) return
        setIsRefreshing(true)
        try {
            await onRefresh()
        } finally {
            // Mantém a animação por pelo menos 600ms para feedback visual
            setTimeout(() => setIsRefreshing(false), 600)
        }
    }

    // ─── CABEÇALHO (compartilhado entre desktop e mobile) ───────────────

    // Injeta o @keyframes para o spin do botão de atualizar
    const spinStyle = (
        <style>{`
            @keyframes spin-refresh {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
            }
            .refreshing {
                animation: spin-refresh 0.8s linear infinite;
            }
        `}</style>
    )

    const Header = () => (
        <div className="calendar-header">
            <div className="calendar-nav">
                {/* Botão ← mês anterior */}
                <button className="btn btn-ghost btn-icon" onClick={previousMonth}>
                    <ChevronLeft size={20} />
                </button>
                {/* Botão "Hoje" — volta para o mês atual */}
                <button className="btn btn-secondary btn-sm" onClick={goToToday}>
                    Hoje
                </button>
                {/* Botão → próximo mês */}
                <button className="btn btn-ghost btn-icon" onClick={nextMonth}>
                    <ChevronRight size={20} />
                </button>
                {/* Botão Atualizar — recarrega dados do calendário */}
                {onRefresh && (
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={handleRefresh}
                        title="Atualizar calendário"
                        style={{ marginLeft: '4px' }}
                    >
                        <RefreshCw
                            size={18}
                            className={isRefreshing ? 'refreshing' : ''}
                            style={{ color: isRefreshing ? 'var(--primary-500)' : undefined }}
                        />
                    </button>
                )}
            </div>

            {/* Nome do mês + ano em português (ex: "fevereiro 2026") */}
            <h2 className="calendar-title">
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>

            {/* Espaçador — centraliza o título no desktop; escondido no mobile */}
            <div style={{ width: '160px' }} className="hide-mobile" />
        </div>
    )

    // ─── LEGENDA DE CORES DAS SALAS (compartilhada + clicável para filtro) ──
    // Clicar em uma sala ativa o filtro → só mostra eventos daquela sala
    // Clicar na mesma sala novamente desativa o filtro → mostra todas
    const Legend = () =>
        rooms.length > 0 ? (
            <div className="room-legend">
                {rooms.map(room => {
                    // Verifica se esta sala está selecionada no filtro
                    const isSelected = selectedRoom === room.name
                    // Se alguma sala está selecionada e não é esta, aplica opacidade
                    const isFiltered = selectedRoom && !isSelected

                    return (
                        <div
                            key={room.id}
                            className={`room-legend-item ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                                // Toggle: se já está selecionada → desmarca; senão → seleciona
                                setSelectedRoom(isSelected ? null : room.name)
                            }}
                            style={{
                                cursor: 'pointer',
                                opacity: isFiltered ? 0.4 : 1,
                                transition: 'all 0.2s ease',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-md)',
                                border: isSelected ? `2px solid ${room.color}` : '2px solid transparent',
                                backgroundColor: isSelected ? `${room.color}15` : 'transparent'
                            }}
                        >
                            <div
                                className="room-legend-color"
                                style={{ backgroundColor: room.color }}
                            />
                            <span>{room.name}</span>
                        </div>
                    )
                })}
            </div>
        ) : null

    // ═══════════════════════════════════════════════════════════════════════
    //  VISÃO MOBILE: Mini-grid compacto + Lista de Agenda
    // ═══════════════════════════════════════════════════════════════════════
    // Inspirado no calendário nativo de smartphones:
    //   - Mini-grid no topo: mostra todos os dias do mês em tamanho compacto
    //     com bolinha indicando dias com eventos
    //   - Agenda abaixo: lista cronológica dos eventos agrupados por dia
    //     mostrando horário, título e sala de cada reunião
    // ═══════════════════════════════════════════════════════════════════════
    if (isMobile) {
        // Filtra apenas dias que possuem pelo menos 1 evento (para a lista de agenda)
        const daysWithEvents = monthDays.filter(
            day => getEventsForDay(day).length > 0
        )

        return (
            <div className="calendar-container">
                {spinStyle}
                <Header />

                {/* ── Mini-grid: calendário compacto de referência ── */}
                {/* Mostra números dos dias em grid 7 colunas. */}
                {/* Dias com eventos ganham uma bolinha colorida embaixo. */}
                {/* O dia atual é destacado com fundo colorido. */}
                <div className="calendar-mini-grid">
                    {/* Cabeçalho: letras dos dias da semana (D, S, T...) */}
                    {weekDaysMobile.map((d, i) => (
                        <div key={i} className="calendar-mini-header">{d}</div>
                    ))}

                    {/* Células vazias antes do dia 1 para alinhar o dia da semana */}
                    {/* Ex: se dia 1 cai numa quarta (3), preenche 3 células vazias */}
                    {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="calendar-mini-day empty" />
                    ))}

                    {/* Dias do mês */}
                    {monthDays.map((day, index) => {
                        const hasEvents = getEventsForDay(day).length > 0
                        const isDayToday = isToday(day)
                        return (
                            <div
                                key={index}
                                className={`calendar-mini-day ${isDayToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
                                onClick={() => onDayClick && onDayClick(day)}
                            >
                                {/* Número do dia */}
                                <span className="calendar-mini-day-number">
                                    {format(day, 'd')}
                                </span>
                                {/* Bolinha indicadora de eventos */}
                                {hasEvents && <span className="calendar-mini-dot" />}
                            </div>
                        )
                    })}
                </div>
                
                {/* Legenda de cores das salas (puxada para cima no mobile) */}
                <Legend />
                
                {/* ── Lista de Agenda: eventos detalhados por dia ── */}
                {/* Mostra cada dia que tem eventos com seus detalhes */}
                <div className="calendar-agenda">
                    {daysWithEvents.length === 0 ? (
                        /* Estado vazio — nenhum evento neste mês */
                        <div className="calendar-agenda-empty">
                            Nenhuma reunião este mês
                        </div>
                    ) : (
                        /* Itera pelos dias que possuem eventos */
                        daysWithEvents.map((day, dayIndex) => {
                            const dayEvents = getEventsForDay(day)
                            const isDayToday = isToday(day)
                            return (
                                <div key={dayIndex} className="calendar-agenda-day">
                                    {/* Cabeçalho do dia: número + nome por extenso */}
                                    {/* Ex: "23  segunda-feira" */}
                                    <div
                                        className={`calendar-agenda-day-header ${isDayToday ? 'today' : ''}`}
                                        onClick={() => onDayClick && onDayClick(day)}
                                    >
                                        <span className="calendar-agenda-day-number">
                                            {format(day, 'd')}
                                        </span>
                                        <span className="calendar-agenda-day-name">
                                            {format(day, 'EEEE', { locale: ptBR })}
                                        </span>
                                    </div>

                                    {/* Cards de eventos do dia */}
                                    <div className="calendar-agenda-events">
                                        {dayEvents.map((event, eventIndex) => (
                                            <div
                                                key={eventIndex}
                                                className="calendar-agenda-event"
                                                onClick={() => onEventClick && onEventClick(event)}
                                            >
                                                {/* Barra lateral colorida — cor da sala */}
                                                <div
                                                    className="calendar-agenda-event-bar"
                                                    style={{ backgroundColor: event.room_color || '#6366f1' }}
                                                />
                                                <div className="calendar-agenda-event-info">
                                                    {/* Horário: "09:00 — 10:00" + ícone Teams */}
                                                    <div className="calendar-agenda-event-time">
                                                        {event.teams_link && <span>🎥 </span>}
                                                        {format(new Date(event.start), 'HH:mm')}
                                                        {' — '}
                                                        {format(new Date(event.end), 'HH:mm')}
                                                        {event.source === 'outlook' && (
                                                            <span style={{
                                                                fontSize: '9px',
                                                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                                                color: '#6366f1',
                                                                padding: '1px 5px',
                                                                borderRadius: '6px',
                                                                fontWeight: 600,
                                                                marginLeft: '6px'
                                                            }}>
                                                                📅 Outlook
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Título da reunião */}
                                                    <div className="calendar-agenda-event-title">
                                                        {event.title}
                                                    </div>
                                                    {/* Nome da sala */}
                                                    <div className="calendar-agenda-event-room">
                                                        {event.room_name}
                                                    </div>
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

    // ═══════════════════════════════════════════════════════════════════════
    //  VISÃO DESKTOP: Grade mensal tradicional (7 colunas × N linhas)
    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="calendar-container">
            {spinStyle}
            <Header />

            <div className="calendar-grid">
                {/* Cabeçalho: nomes dos dias da semana (Dom, Seg, ...) */}
                {weekDays.map(day => (
                    <div key={day} className="calendar-day-header">
                        {day}
                    </div>
                ))}

                {/* Células dos dias (inclui dias de meses adjacentes) */}
                {days.map((day, index) => {
                    const dayEvents = getEventsForDay(day)                    // Eventos neste dia
                    const isCurrentMonth = isSameMonth(day, currentDate)      // Pertence ao mês atual?
                    const isDayToday = isToday(day)                           // É hoje?
                    const isHovered = hoveredDay === index                    // Popover visível?

                    return (
                        <div
                            key={index}
                            className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isDayToday ? 'today' : ''}`}
                            onClick={() => onDayClick && onDayClick(day)}
                            onMouseEnter={() => dayEvents.length > 0 && setHoveredDay(index)}
                            onMouseLeave={() => setHoveredDay(null)}
                            style={{ position: 'relative' }}
                        >
                            {/* Número do dia — bolinha especial para "hoje" */}
                            <div className="calendar-day-number">
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

                            {/* Lista de eventos (máximo 3 visíveis + "+N mais") */}
                            <div className="calendar-events">
                                {dayEvents.slice(0, 3).map((event, eventIndex) => (
                                    <div
                                        key={eventIndex}
                                        className="calendar-event"
                                        style={{ backgroundColor: event.room_color || '#6366f1' }}
                                        onClick={(e) => {
                                            e.stopPropagation()  // Não dispara onDayClick junto
                                            onEventClick && onEventClick(event)
                                        }}
                                        title={`${event.title} - ${event.room_name}`}
                                    >
                                        {/* Ícone Teams se tiver link */}
                                        {event.teams_link && <span style={{ marginRight: '4px' }}>🎥</span>}
                                        {event.source === 'outlook' && <span style={{ marginRight: '3px' }}>📅</span>}
                                        {/* Horário + título */}
                                        {format(new Date(event.start), 'HH:mm')} {event.title}
                                    </div>
                                ))}
                                {/* Indicador "+N mais" se houver mais de 3 eventos */}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs" style={{
                                        color: 'var(--text-secondary)',
                                        paddingLeft: 'var(--space-sm)'
                                    }}>
                                        +{dayEvents.length - 3} mais
                                    </div>
                                )}
                            </div>

                            {/* ── POPOVER: mostra TODAS as reuniões ao passar o mouse ── */}
                            {/* Aparece flutuando sobre a célula quando o mouse entra */}
                            {/* Posicionamento: centralizado abaixo da célula */}
                            {isHovered && dayEvents.length > 0 && (
                                <div className="calendar-day-popover">
                                    {/* Cabeçalho: data completa por extenso */}
                                    <div className="calendar-day-popover-header">
                                        {format(day, "d 'de' MMMM", { locale: ptBR })}
                                        <span className="calendar-day-popover-count">
                                            {dayEvents.length} {dayEvents.length === 1 ? 'reunião' : 'reuniões'}
                                        </span>
                                    </div>
                                    {/* Lista completa de eventos do dia */}
                                    <div className="calendar-day-popover-events">
                                        {dayEvents.map((event, eventIndex) => (
                                            <div
                                                key={eventIndex}
                                                className="calendar-day-popover-event"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onEventClick && onEventClick(event)
                                                }}
                                            >
                                                {/* Bolinha colorida da sala */}
                                                <div
                                                    className="calendar-day-popover-dot"
                                                    style={{ backgroundColor: event.room_color || '#6366f1' }}
                                                />
                                                <div className="calendar-day-popover-event-info">
                                                    <span className="calendar-day-popover-time">
                                                        {event.teams_link && '🎥 '}
                                                        {format(new Date(event.start), 'HH:mm')} — {format(new Date(event.end), 'HH:mm')}
                                                    </span>
                                                    <span className="calendar-day-popover-title">
                                                        {event.title}
                                                    </span>
                                                    <span className="calendar-day-popover-room">
                                                        {event.room_name}
                                                        {event.source === 'outlook' && (
                                                            <span style={{
                                                                fontSize: '9px',
                                                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                                                color: '#6366f1',
                                                                padding: '1px 5px',
                                                                borderRadius: '6px',
                                                                fontWeight: 600,
                                                                marginLeft: '6px'
                                                            }}>
                                                                📅 Outlook
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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

/**
 * =============================================================
 *   CalendarPage.jsx — Página do calendário mensal
 * =============================================================
 *   Responsável por:
 *   - Exibir o componente Calendar com eventos de todas as salas
 *   - Carregar eventos e salas do backend (Promise.all)
 *   - Abrir modal com detalhes ao clicar em um evento
 *   - Navegar para "Nova Reunião" ao clicar em um dia
 *   - Exibir link do Teams quando disponível
 *   
 *   Interações:
 *   - Clicar em um DIA → navega para /new-meeting com a data selecionada
 *   - Clicar em um EVENTO → abre modal com detalhes da reunião
 *   
 *   Dados carregados:
 *   - Eventos via meetingService.getCalendarEvents(start, end)
 *   - Salas via roomService.getRooms() (para legenda de cores)
 * =============================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Calendar from '../components/Calendar/Calendar'
import Modal from '../components/Common/Modal'
import { meetingService } from '../services/meetingService'
import { roomService } from '../services/roomService'
import { startOfMonth, endOfMonth, addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, Building2, Users, User, X, Pencil, CheckCircle } from 'lucide-react'

function CalendarPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [events, setEvents] = useState([])            // Eventos do calendário
    const [rooms, setRooms] = useState([])              // Salas (para legenda de cores)
    const [loading, setLoading] = useState(true)         // Carregamento inicial
    const [selectedEvent, setSelectedEvent] = useState(null) // Evento selecionado no modal
    const [currentMonth, setCurrentMonth] = useState(new Date()) // Mês sendo exibido
    const [successMessage, setSuccessMessage] = useState(location.state?.successMessage || null)

    // Recarrega dados quando o mês muda (navegação do Calendar)
    useEffect(() => {
        loadData()
    }, [currentMonth])

    /**
     * Carrega eventos e salas em paralelo.
     * Busca eventos do mês atual + próximo (para exibir corretamente).
     */
    async function loadData() {
        try {
            setLoading(true)
            await fetchCalendarData()
        } catch (error) {
            console.error('Error loading calendar data:', error)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Recarrega os dados silenciosamente (sem mostrar spinner).
     * Usada pelo auto-refresh de 10s e pelo botão "Atualizar".
     */
    const silentRefresh = useCallback(async () => {
        try {
            await fetchCalendarData()
        } catch (error) {
            console.error('Error refreshing calendar data:', error)
        }
    }, [currentMonth])

    /**
     * Função compartilhada que busca eventos e salas.
     */
    async function fetchCalendarData() {
        const start = startOfMonth(currentMonth)
        const end = endOfMonth(addMonths(currentMonth, 1))

        const [eventsData, roomsData] = await Promise.all([
            meetingService.getCalendarEvents(start, end),
            roomService.getRooms()
        ])

        setEvents(eventsData)
        setRooms(roomsData)
    }

    // Auto-refresh a cada 10 segundos (sem mostrar spinner)
    useEffect(() => {
        const interval = setInterval(() => {
            silentRefresh()
        }, 10000)  // 10 segundos

        return () => clearInterval(interval)  // Limpa ao desmontar
    }, [silentRefresh])

    /**
     * Ao clicar em um dia do calendário:
     * Navega para a página de "Nova Reunião" com a data pré-selecionada.
     * Converte o objeto Date para string 'yyyy-MM-dd' para evitar erros no NewMeeting.
     */
    const handleDayClick = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        navigate('/new-meeting', { state: { selectedDate: dateStr } })
    }

    /** Ao clicar em um evento: abre o modal de detalhes */
    const handleEventClick = (event) => {
        setSelectedEvent(event)
    }

    /** Navega para edição da reunião, informando a rota de retorno */
    const handleEditMeeting = (event) => {
        setSelectedEvent(null)
        navigate('/new-meeting', {
            state: {
                editMeeting: event,
                returnTo: location.pathname  // '/calendar'
            }
        })
    }

    /** Limpa mensagem de sucesso após 5s */
    useEffect(() => {
        if (successMessage) {
            const t = setTimeout(() => setSuccessMessage(null), 5000)
            return () => clearTimeout(t)
        }
    }, [successMessage])

    // Tela de carregamento
    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <div className="spinner spinner-lg" />
            </div>
        )
    }

    return (
        <div>
            {/* Mensagem de sucesso (pós-edição) */}
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

            {/* Cabeçalho da página */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h1>Calendário</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Visualize e gerencie todas as reuniões agendadas
                </p>
            </div>

            {/* Componente Calendar — grade mensal com eventos */}
            <Calendar
                events={events}
                rooms={rooms}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
                onRefresh={silentRefresh}
            />

            {/* === MODAL DE DETALHES DO EVENTO === */}
            <Modal
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                title="Detalhes da Reunião"
                footer={
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
                        {selectedEvent?.is_own_meeting && selectedEvent?.id && (
                            <button
                                className="btn btn-primary"
                                onClick={() => handleEditMeeting(selectedEvent)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Pencil size={15} /> Editar Reunião
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>
                            Fechar
                        </button>
                    </div>
                }
            >
                {selectedEvent && (
                    <div className="flex flex-col gap-lg">
                        {/* Título + badge da sala */}
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

                        {/* Informações: data/hora, sala, organizador */}
                        <div className="flex flex-col gap-md">
                            {/* Data e horário */}
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

                            {/* Sala */}
                            <div className="flex items-center gap-md">
                                <Building2 size={20} style={{ color: 'var(--text-secondary)' }} />
                                <div>
                                    <p className="font-medium">{selectedEvent.room_name}</p>
                                </div>
                            </div>

                            {/* Organizador */}
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

                        {/* Indicador: "Esta é sua reunião" */}
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

                        {/* Botão "Entrar pelo Teams" — se reunião tem link */}
                        {selectedEvent.teams_link && (
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
                                    href={selectedEvent.teams_link}
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
        </div>
    )
}

export default CalendarPage

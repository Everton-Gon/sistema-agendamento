/**
 * =============================================================
 *   NewMeeting.jsx — Página de agendamento de nova reunião
 * =============================================================
 *   Responsável por:
 *   - Formulário completo para agendar reuniões
 *   - Seleção de sala, data, horário (início/fim)
 *   - Gerenciamento de participantes (adicionar/remover)
 *   - Verificação de disponibilidade em tempo real
 *   - Sugestão de salas alternativas em caso de conflito
 *   - Envio da reunião para o backend
 *   
 *   Validações:
 *   - Título obrigatório
 *   - Sala obrigatória
 *   - Data obrigatória
 *   - Horários obrigatórios e fim > início
 *   
 *   Verificação de disponibilidade:
 *   - Dispara automaticamente quando sala + data + horário estão preenchidos
 *   - Indica "Disponível" (verde) ou "Conflito" (vermelho)
 *   - Em caso de conflito, sugere salas alternativas disponíveis
 *   
 *   Tratamento de erro 409:
 *   - Backend retorna conflito → exibe mensagem + salas sugeridas
 * =============================================================
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { meetingService } from '../services/meetingService'
import { roomService } from '../services/roomService'
import { userService } from '../services/userService'
import { useToast } from '../components/Common/Toast'
import { format } from 'date-fns'
import {
    Calendar,
    Clock,
    Building2,
    Users,
    Plus,
    X,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    FileText,
    Mail,
    Repeat,
    Search
} from 'lucide-react'

function NewMeeting() {
    const navigate = useNavigate()
    const location = useLocation()
    const toast = useToast()

    // Estado do formulário — pré-preenche campos se veio da página de salas
    const [formData, setFormData] = useState({
        title: '',
        room_id: location.state?.selectedRoom ? String(location.state.selectedRoom) : '',
        date: location.state?.selectedDate
            ? (location.state.selectedDate.includes('T')
                ? format(new Date(location.state.selectedDate), 'yyyy-MM-dd')
                : location.state.selectedDate)
            : format(new Date(), 'yyyy-MM-dd'),
        start_time: location.state?.selectedStartTime || '',
        end_time: location.state?.selectedEndTime || '',
        description: '',
        participants: [],    // Lista de emails dos participantes
        is_recurring: false,
        recurrence_frequency: 'weekly',
        recurrence_days: [],
        recurrence_end_date: ''
    })

    // Estados auxiliares
    const [rooms, setRooms] = useState([])                     // Salas disponíveis
    const [loading, setLoading] = useState(true)                // Carregando salas?
    const [submitting, setSubmitting] = useState(false)          // Enviando formulário?
    const [errors, setErrors] = useState({})                    // Erros de validação
    const [participantEmail, setParticipantEmail] = useState('') // Email sendo digitado
    const [checkingAvailability, setCheckingAvailability] = useState(false) // Verificando?
    const [availabilityStatus, setAvailabilityStatus] = useState(null)     // Resultado da verificação
    const [suggestedRooms, setSuggestedRooms] = useState([])    // Salas alternativas
    const [suggestions, setSuggestions] = useState([])      // Pessoas encontradas
    const [showSuggestions, setShowSuggestions] = useState(false) // Mostra/esconde o menu
    const [isSearching, setIsSearching] = useState(false)   // Status da busca
    const [focusedIndex, setFocusedIndex] = useState(-1)    // Item focado pelo teclado
    const itemRefs = useRef([])                              // Refs para auto-scroll

    // Carrega lista de salas ao montar
    useEffect(() => {
        loadRooms()
    }, [])

    // === MODO EDICAO: detecta se veio com uma reuniao para editar ===
    const editMeeting = location.state?.editMeeting || null
    const returnTo = location.state?.returnTo || '/my-meetings'
    const isEditing = !!editMeeting
    const editMeetingId = editMeeting?.id || null

    // Proteção F5: se isEditing mas location.state sumiu, volta para origem
    useEffect(() => {
        if (!isEditing) return
        if (!editMeetingId) {
            navigate('/my-meetings', { replace: true })
        }
    }, [])

    // Pré-preenche o formulário quando em modo de edição
    useEffect(() => {
        if (!editMeeting) return
        const start = new Date(editMeeting.start || editMeeting.start_datetime)
        const end = new Date(editMeeting.end || editMeeting.end_datetime)
        setFormData(prev => ({
            ...prev,
            title: editMeeting.title || '',
            room_id: String(editMeeting.room_id || ''),
            date: format(start, 'yyyy-MM-dd'),
            start_time: format(start, 'HH:mm'),
            end_time: format(end, 'HH:mm'),
            description: editMeeting.description || '',
            participants: (editMeeting.attendees || []).map(a =>
                typeof a === 'string' ? a : a.email
            ).filter(Boolean)
        }))
    }, [])

    // Verifica disponibilidade quando sala, data ou horários mudam
    useEffect(() => {
        if (formData.room_id && formData.date && formData.start_time && formData.end_time) {
            // Delay para não chamar a API a cada tecla
            const timer = setTimeout(checkAvailability, 500)
            return () => clearTimeout(timer)
        } else {
            setAvailabilityStatus(null)
            setSuggestedRooms([])
        }
    }, [formData.room_id, formData.date, formData.start_time, formData.end_time])

    // Auto-scroll para o item focado pelo teclado
    useEffect(() => {
        if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
            itemRefs.current[focusedIndex].scrollIntoView({ block: 'nearest' })
        }
    }, [focusedIndex])

    /** Busca lista de salas do backend */
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

    /**
     * Verifica disponibilidade da sala no horário selecionado.
     * Chama a API com sala, data de início e data de fim.
     * Atualiza availabilityStatus com:
     * - { type: 'success', message: 'Horário disponível!' } se livre
     * - { type: 'error', message: '...' } se conflito
     * Se indisponível, popula suggestedRooms com alternativas.
     */
    async function checkAvailability() {
        setCheckingAvailability(true)
        setAvailabilityStatus(null)
        setSuggestedRooms([])

        try {
            const startStr = `${formData.date}T${formData.start_time}:00`
            const endStr = `${formData.date}T${formData.end_time}:00`

            // Em modo edição, passa o meeting_id para excluir a própria reunião da verificação
            const result = await meetingService.checkAvailability(
                formData.room_id,
                startStr,
                endStr,
                isEditing ? editMeetingId : null
            )

            if (result.is_available) {
                setAvailabilityStatus({ type: 'success', message: 'Horário disponível!' })
            } else {
                setAvailabilityStatus({
                    type: 'error',
                    message: result.conflict?.message || 'Horário indisponível'
                })
                setSuggestedRooms(result.available_rooms || [])
            }
        } catch (error) {
            console.error('Error checking availability:', error)
        } finally {
            setCheckingAvailability(false)
        }
    }

    /**
     * Adiciona um participante à lista.
     * Validações:
     * - Email deve conter "@"
     * - Não permite duplicatas
     */
    function addParticipant(emailToAdd) {
        const email = emailToAdd || participantEmail
        if (!email || !email.includes('@')) return
        if (formData.participants.includes(email)) return

        setFormData(prev => ({
            ...prev,
            participants: [...prev.participants, email]
        }))
        setParticipantEmail('')
        setShowSuggestions(false)
        setSuggestions([])
    }

    /** Remove um participante da lista pelo email */
    function removeParticipant(email) {
        setFormData({
            ...formData,
            participants: formData.participants.filter(p => p !== email)
        })
    }

    /**
     * People Picker — detecta "@" e busca usuários no backend.
     * Atualiza a lista de sugestões conforme o usuário digita.
     */
    const searchTimeout = useRef(null)
    async function handleParticipantChange(e) {
        const value = e.target.value
        setParticipantEmail(value)
        setFocusedIndex(-1) // reseta ao digitar

        // Esconde sugestões se não tiver @ ou campo vazio
        if (!value || !value.includes('@')) {
            setShowSuggestions(false)
            return
        }

        // Pega o texto antes do @ como query de busca (ex: "everton" de "@everton")
        // ou usa o texto depois do @ como fallback
        const atIndex = value.lastIndexOf('@')
        const query = atIndex === 0 ? value.slice(1) : value

        if (query.length >= 2) {
            // Debounce: espera 300ms após o usuário parar de digitar
            clearTimeout(searchTimeout.current)
            searchTimeout.current = setTimeout(async () => {
                setIsSearching(true)
                setShowSuggestions(true)
                const results = await userService.searchUsers(query)
                setSuggestions(results)
                setIsSearching(false)
            }, 300)
        } else {
            setShowSuggestions(false)
        }
    }

    /**
     * Valida e envia o formulário de nova reunião.
     * 1. Valida campos obrigatórios
     * 2. Verifica se horário de fim > início
     * 3. Envia dados para meetingService.createMeeting()
     * 4. Em sucesso → toast + navega para MyMeetings
     * 5. Em erro 409 → exibe conflito + salas sugeridas
     * 6. Em outros erros → mensagem genérica
     */
    async function handleSubmit(e) {
        e.preventDefault()

        // Validação de campos obrigatórios
        const newErrors = {}
        if (!formData.title) newErrors.title = 'Título é obrigatório'
        if (!formData.room_id) newErrors.room_id = 'Selecione uma sala'
        if (!formData.date) newErrors.date = 'Selecione uma data'
        if (!formData.start_time) newErrors.start_time = 'Selecione o horário de início'
        if (!formData.end_time) newErrors.end_time = 'Selecione o horário de fim'

        // Validação: horário de fim deve ser posterior ao de início
        if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
            newErrors.end_time = 'Horário de fim deve ser após o início'
        }

        // Validação: campos de recorrência (apenas no modo criação)
        if (!isEditing && formData.is_recurring) {
            if (!formData.recurrence_end_date) {
                newErrors.recurrence_end_date = 'Selecione a data final da recorrência'
            } else {
                // Valida o limite de 60 dias
                const startRef = new Date(formData.date + 'T00:00:00')
                const endRef = new Date(formData.recurrence_end_date + 'T00:00:00')
                const maxEnd = new Date(startRef)
                maxEnd.setDate(maxEnd.getDate() + 60)
                if (endRef > maxEnd) {
                    newErrors.recurrence_end_date = 'A recorrência não pode ultrapassar 60 dias (2 meses) a partir da data de início'
                }
            }
            if ((formData.recurrence_frequency === 'weekly' || formData.recurrence_frequency === 'biweekly')
                && formData.recurrence_days.length === 0) {
                newErrors.recurrence_days = 'Selecione ao menos um dia da semana'
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            return
        }

        setSubmitting(true)
        setErrors({})

        try {
            const meetingData = {
                title: formData.title,
                room_id: parseInt(formData.room_id),
                start_datetime: `${formData.date}T${formData.start_time}:00`,
                end_datetime: `${formData.date}T${formData.end_time}:59`,
                description: formData.description,
                attendees: formData.participants.map(email => ({
                    email: email,
                    name: email.split('@')[0]
                }))
            }

            if (isEditing) {
                // === MODO EDICAO: PUT /api/meetings/:id ===
                await meetingService.updateMeeting(editMeetingId, meetingData)
                toast.success('Reunião atualizada com sucesso!')
                navigate(returnTo, { state: { successMessage: 'Reunião atualizada com sucesso!' } })
            } else {
                // === MODO CRIACAO: POST /api/meetings ===
                const fullData = {
                    ...meetingData,
                    is_recurring: formData.is_recurring,
                    recurrence_frequency: formData.is_recurring ? formData.recurrence_frequency : null,
                    recurrence_days: formData.is_recurring ? formData.recurrence_days : null,
                    recurrence_end_date: formData.is_recurring ? formData.recurrence_end_date : null
                }
                const result = await meetingService.createMeeting(fullData)
                const total = result?.total_occurrences || 1
                const skipped = result?.skipped_conflicts || 0
                let msg = total > 1
                    ? `${total} reuniões recorrentes criadas com sucesso!`
                    : 'Reunião agendada com sucesso!'
                if (skipped > 0) msg += ` (${skipped} data(s) com conflito foram ignoradas)`
                toast.success(msg)
                navigate('/my-meetings', { state: { success: 'Reunião agendada com sucesso!' } })
            }
        } catch (error) {
            console.error('Error saving meeting:', error)

            // Tratamento específico: conflito de horário (HTTP 409)
            if (error.response?.status === 409) {
                const data = error.response.data.detail
                setErrors({ submit: data.message })
                setSuggestedRooms(data.available_rooms || [])
            } else {
                setErrors({ submit: 'Erro ao salvar a reunião. Tente novamente.' })
            }
        } finally {
            setSubmitting(false)
        }
    }

    /**
     * Preenche os campos de horário com base no atalho selecionado.
     * - manha: 08:00 - 11:59
     * - tarde: 12:00 - 18:00
     * - dia:   08:00 - 18:00
     */
    function handleQuickTime(type) {
        const times = {
            manha: { start: '08:00', end: '12:00' },
            tarde: { start: '12:00', end: '18:00' },
            dia:   { start: '08:00', end: '18:00' },
        }
        setFormData(prev => ({
            ...prev,
            start_time: times[type].start,
            end_time:   times[type].end,
        }))
    }

    // Tela de carregamento (enquanto carrega salas)
    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <div className="spinner spinner-lg" />
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            {/* Cabeçalho da página */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h1>{isEditing ? 'Editar Agendamento' : 'Agendar Reunião'}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    {isEditing
                        ? 'Ajuste os dados da reunião e salve as alterações'
                        : 'Preencha os dados para agendar uma nova reunião'}
                </p>
            </div>

            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        {/* ====== CAMPO: Título ====== */}
                        <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                            <label className="input-label">
                                <FileText size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                Título da Reunião *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className={`input ${errors.title ? 'input-error' : ''}`}
                                placeholder="Ex: Reunião de planejamento semanal"
                            />
                            {errors.title && <span className="input-error-text">{errors.title}</span>}
                        </div>

                        {/* ====== CAMPO: Sala ====== */}
                        <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                            <label className="input-label">
                                <Building2 size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                Sala *
                            </label>
                            <select
                                value={formData.room_id}
                                onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                                className={`input ${errors.room_id ? 'input-error' : ''}`}
                            >
                                <option value="">Selecione uma sala</option>
                                {rooms.map(room => (
                                    <option key={room.id} value={room.id}>
                                        {room.name} (capacidade: {room.capacity})
                                    </option>
                                ))}
                            </select>
                            {errors.room_id && <span className="input-error-text">{errors.room_id}</span>}
                        </div>

                        {/* ====== CAMPOS: Data + Horários (grid 3 colunas) ====== */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 'var(--space-md)',
                            marginBottom: 'var(--space-md)'
                        }}>
                            {/* Campo: Data */}
                            <div className="input-group">
                                <label className="input-label">
                                    <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                    Data *
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className={`input ${errors.date ? 'input-error' : ''}`}
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                />
                                {errors.date && <span className="input-error-text">{errors.date}</span>}
                            </div>

                            {/* Campo: Horário de início */}
                            <div className="input-group">
                                <label className="input-label">
                                    <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                    Início *
                                </label>
                                <input
                                    type="time"
                                    value={formData.start_time}
                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                    className={`input ${errors.start_time ? 'input-error' : ''}`}
                                />
                                {errors.start_time && <span className="input-error-text">{errors.start_time}</span>}
                            </div>

                            {/* Campo: Horário de fim */}
                            <div className="input-group">
                                <label className="input-label">
                                    <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                    Fim *
                                </label>
                                <input
                                    type="time"
                                    value={formData.end_time}
                                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                    className={`input ${errors.end_time ? 'input-error' : ''}`}
                                />
                                {errors.end_time && <span className="input-error-text">{errors.end_time}</span>}
                            </div>
                        </div>

                        {/* ====== ATALHOS DE HORÁRIO ====== */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                            {[
                                { key: 'manha', label: '🌅 Manhã', desc: '08:00 - 12:00' },
                                { key: 'tarde', label: '🌇 Tarde',  desc: '12:00 - 18:00' },
                                { key: 'dia',   label: '📅 Dia',    desc: '08:00 - 18:00' },
                            ].map(({ key, label, desc }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleQuickTime(key)}
                                    title={desc}
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: '999px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: 500,
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'var(--primary-50)'
                                        e.currentTarget.style.color = 'var(--primary)'
                                        e.currentTarget.style.borderColor = 'var(--primary)'
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'var(--bg-secondary)'
                                        e.currentTarget.style.color = 'var(--text-secondary)'
                                        e.currentTarget.style.borderColor = 'var(--border-color)'
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* ====== INDICADOR DE DISPONIBILIDADE ====== */}
                        {/* Mostra resultado da verificação em tempo real */}
                        {checkingAvailability && (
                            <div className="flex items-center gap-sm" style={{
                                padding: 'var(--space-md)',
                                marginBottom: 'var(--space-md)',
                                backgroundColor: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <div className="spinner spinner-sm" />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    Verificando disponibilidade...
                                </span>
                            </div>
                        )}

                        {/* Status: Disponível (verde) */}
                        {availabilityStatus?.type === 'success' && (
                            <div style={{
                                padding: 'var(--space-md)',
                                marginBottom: 'var(--space-md)',
                                backgroundColor: 'var(--success-light)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)'
                            }}>
                                <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                                <span className="text-sm" style={{ color: '#15803d' }}>
                                    {availabilityStatus.message}
                                </span>
                            </div>
                        )}

                        {/* Status: Conflito (vermelho) + salas sugeridas */}
                        {availabilityStatus?.type === 'error' && (
                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <div style={{
                                    padding: 'var(--space-md)',
                                    backgroundColor: 'var(--error-light)',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-sm)',
                                    marginBottom: suggestedRooms.length > 0 ? 'var(--space-sm)' : '0'
                                }}>
                                    <AlertCircle size={18} style={{ color: 'var(--error)' }} />
                                    <span className="text-sm" style={{ color: '#b91c1c' }}>
                                        {availabilityStatus.message}
                                    </span>
                                </div>

                                {/* Sugestão de salas alternativas disponíveis */}
                                {suggestedRooms.length > 0 && (
                                    <div style={{
                                        padding: 'var(--space-md)',
                                        backgroundColor: 'var(--primary-50)',
                                        borderRadius: 'var(--radius-md)'
                                    }}>
                                        <p className="text-sm font-medium" style={{
                                            color: 'var(--primary-700)',
                                            marginBottom: 'var(--space-sm)'
                                        }}>
                                            Salas disponíveis neste horário:
                                        </p>
                                        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                            {suggestedRooms.map(room => (
                                                <button
                                                    key={room.id}
                                                    type="button"
                                                    className="btn btn-sm"
                                                    style={{
                                                        backgroundColor: room.color + '20',
                                                        color: room.color,
                                                        border: `1px solid ${room.color}50`
                                                    }}
                                                    onClick={() => setFormData({ ...formData, room_id: String(room.id) })}
                                                >
                                                    {room.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ====== SEÇÃO: Reunião Recorrente ====== */}
                        <div style={{
                            marginBottom: 'var(--space-md)',
                            padding: 'var(--space-md)',
                            backgroundColor: formData.is_recurring ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                            borderRadius: 'var(--radius-lg)',
                            border: formData.is_recurring ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                            transition: 'all 0.3s ease'
                        }}>
                            {/* Toggle */}
                            <div
                                onClick={() => setFormData({ ...formData, is_recurring: !formData.is_recurring })}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-sm)',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                            >
                                <div style={{
                                    width: '44px',
                                    height: '24px',
                                    borderRadius: '12px',
                                    backgroundColor: formData.is_recurring ? 'var(--primary-500)' : '#d1d5db',
                                    position: 'relative',
                                    transition: 'background-color 0.2s ease',
                                    flexShrink: 0
                                }}>
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        backgroundColor: 'white',
                                        position: 'absolute',
                                        top: '2px',
                                        left: formData.is_recurring ? '22px' : '2px',
                                        transition: 'left 0.2s ease',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                                <Repeat size={16} style={{ color: formData.is_recurring ? 'var(--primary-500)' : 'var(--text-secondary)' }} />
                                <span style={{
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: formData.is_recurring ? 'var(--primary)' : 'var(--text-secondary)'
                                }}>
                                    Reunião Recorrente
                                </span>
                            </div>

                            {/* Campos de recorrência (visíveis quando ativo) */}
                            {formData.is_recurring && (
                                <div style={{
                                    marginTop: 'var(--space-md)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)',
                                    animation: 'fadeIn 0.3s ease'
                                }}>
                                    {/* Frequência */}
                                    <div className="input-group">
                                        <label className="input-label" style={{ fontSize: '0.8rem' }}>
                                            Frequência
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {[
                                                { value: 'daily', label: 'Diária' },
                                                { value: 'weekly', label: 'Semanal' },
                                                { value: 'biweekly', label: 'Quinzenal' },
                                                { value: 'monthly', label: 'Mensal' }
                                            ].map(freq => (
                                                <button
                                                    key={freq.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, recurrence_frequency: freq.value })}
                                                    style={{
                                                        padding: '6px 16px',
                                                        borderRadius: '20px',
                                                        border: formData.recurrence_frequency === freq.value
                                                            ? '2px solid var(--primary)'
                                                            : '1px solid #d1d5db',
                                                        backgroundColor: formData.recurrence_frequency === freq.value
                                                            ? 'var(--primary-500)'
                                                            : 'white',
                                                        color: formData.recurrence_frequency === freq.value
                                                            ? 'white'
                                                            : 'var(--text-secondary)',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '500',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    {freq.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dias da semana (apenas para semanal/quinzenal) */}
                                    {(formData.recurrence_frequency === 'weekly' || formData.recurrence_frequency === 'biweekly') && (
                                        <div className="input-group">
                                            <label className="input-label" style={{ fontSize: '0.8rem' }}>
                                                Dias da Semana
                                            </label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {[
                                                    { value: 0, label: 'Seg' },
                                                    { value: 1, label: 'Ter' },
                                                    { value: 2, label: 'Qua' },
                                                    { value: 3, label: 'Qui' },
                                                    { value: 4, label: 'Sex' }
                                                ].map(day => {
                                                    const isSelected = formData.recurrence_days.includes(day.value)
                                                    return (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => {
                                                                const days = isSelected
                                                                    ? formData.recurrence_days.filter(d => d !== day.value)
                                                                    : [...formData.recurrence_days, day.value].sort()
                                                                setFormData({ ...formData, recurrence_days: days })
                                                            }}
                                                            style={{
                                                                width: '48px',
                                                                height: '40px',
                                                                borderRadius: 'var(--radius-md)',
                                                                border: isSelected
                                                                    ? '2px solid var(--primary)'
                                                                    : '1px solid #d1d5db',
                                                                backgroundColor: isSelected
                                                                    ? 'var(--primary-500)'
                                                                    : 'white',
                                                                color: isSelected ? 'white' : 'var(--text-secondary)',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '600',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Data final */}
                                    <div className="input-group">
                                        <label className="input-label" style={{ fontSize: '0.8rem' }}>
                                            <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                            Repetir até
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.recurrence_end_date}
                                            onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                                            className="input"
                                            min={formData.date || format(new Date(), 'yyyy-MM-dd')}
                                            max={(() => {
                                                const base = formData.date ? new Date(formData.date + 'T00:00:00') : new Date()
                                                base.setDate(base.getDate() + 60)
                                                return format(base, 'yyyy-MM-dd')
                                            })()}
                                            style={{ maxWidth: '220px' }}
                                        />
                                        <span style={{
                                            fontSize: '0.72rem',
                                            color: 'var(--text-muted)',
                                            marginTop: '4px',
                                            display: 'block'
                                        }}>
                                            ⚠️ Máximo de 60 dias (2 meses) a partir da data de início
                                        </span>
                                    </div>

                                    {/* Preview: quantas reuniões serão criadas */}
                                    {formData.recurrence_end_date && formData.date && (() => {
                                        let count = 0
                                        const startDate = new Date(formData.date + 'T00:00:00')
                                        const endDate = new Date(formData.recurrence_end_date + 'T00:00:00')
                                        const freq = formData.recurrence_frequency
                                        const days = formData.recurrence_days

                                        if (freq === 'daily') {
                                            let d = new Date(startDate)
                                            while (d <= endDate) {
                                                if (d.getDay() >= 1 && d.getDay() <= 5) count++
                                                d.setDate(d.getDate() + 1)
                                            }
                                        } else if (freq === 'weekly' || freq === 'biweekly') {
                                            let d = new Date(startDate)
                                            let weekCount = 0
                                            let lastWeek = -1
                                            while (d <= endDate) {
                                                const weekNum = Math.floor((d - startDate) / (7 * 24 * 60 * 60 * 1000))
                                                if (weekNum !== lastWeek) { lastWeek = weekNum; weekCount++ }
                                                // JS: 0=dom,1=seg...6=sab → nosso: 0=seg,1=ter...4=sex
                                                const jsDay = d.getDay()
                                                const ourDay = jsDay === 0 ? 6 : jsDay - 1
                                                if (days.includes(ourDay)) {
                                                    if (freq === 'weekly' || weekCount % 2 === 1) count++
                                                }
                                                d.setDate(d.getDate() + 1)
                                            }
                                        } else if (freq === 'monthly') {
                                            let d = new Date(startDate)
                                            while (d <= endDate) {
                                                count++
                                                d.setMonth(d.getMonth() + 1)
                                            }
                                        }

                                        if (count === 0) return null
                                        return (
                                            <div style={{
                                                padding: 'var(--space-sm) var(--space-md)',
                                                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                                borderRadius: 'var(--radius-md)',
                                                borderLeft: '3px solid var(--primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)'
                                            }}>
                                                <Repeat size={14} style={{ color: 'var(--primary)' }} />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '500' }}>
                                                    {count} reunião(ões) serão criadas
                                                </span>
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* ====== CAMPO: Descrição (opcional) ====== */}
                        <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                            <label className="input-label">
                                <FileText size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                Descrição
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="input"
                                placeholder="Descreva a pauta da reunião (opcional)"
                                rows={3}
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        {/* ====== SEÇÃO: Participantes ====== */}
                        <div className="input-group" style={{ marginBottom: 'var(--space-lg)' }}>
                            <label className="input-label">
                                <Users size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                Participantes
                            </label>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-4px', display: 'block', marginBottom: 'var(--space-xs)' }}>
                                Digite o e-mail ou use @ para buscar colegas
                            </span>

                            {/* Input + botão + popover de sugestões */}
                            <div style={{ position: 'relative' }}>
                                <div className="flex gap-sm">
                                    <input
                                        type="text"
                                        value={participantEmail}
                                        onChange={handleParticipantChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault()
                                                setFocusedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault()
                                                setFocusedIndex(prev => Math.max(prev - 1, 0))
                                            } else if (e.key === 'Enter') {
                                                e.preventDefault()
                                                if (showSuggestions && focusedIndex >= 0) {
                                                    addParticipant(suggestions[focusedIndex].email)
                                                } else if (!showSuggestions) {
                                                    addParticipant()
                                                }
                                            } else if (e.key === 'Escape') {
                                                setShowSuggestions(false)
                                                setFocusedIndex(-1)
                                            }
                                        }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        className="input"
                                        placeholder="email@mallory.com.br ou @nome"
                                        style={{ flex: 1 }}
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => addParticipant()}
                                        className="btn btn-secondary"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>

                                {/* ── Popover de Sugestões (People Picker) ── */}
                                {showSuggestions && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 4px)',
                                        left: 0,
                                        right: '52px',
                                        backgroundColor: 'white',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                        zIndex: 9999,
                                        overflow: 'hidden',
                                        maxHeight: '280px',
                                        overflowY: 'auto'
                                    }}>
                                        {isSearching ? (
                                            <div style={{
                                                padding: 'var(--space-md)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.875rem'
                                            }}>
                                                <Search size={14} />
                                                Buscando...
                                            </div>
                                        ) : suggestions.length === 0 ? (
                                            <div style={{
                                                padding: 'var(--space-md)',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.875rem',
                                                textAlign: 'center'
                                            }}>
                                                Nenhum usuário encontrado
                                            </div>
                                        ) : (
                                            suggestions.map((user, idx) => (
                                                <div
                                                    key={user.email}
                                                    ref={el => itemRefs.current[idx] = el}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        addParticipant(user.email)
                                                    }}
                                                    onMouseEnter={() => setFocusedIndex(idx)}
                                                    onMouseLeave={() => setFocusedIndex(-1)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--space-sm)',
                                                        padding: '10px var(--space-md)',
                                                        cursor: 'pointer',
                                                        transition: 'background 0.15s',
                                                        background: focusedIndex === idx ? 'var(--primary-50)' : 'transparent'
                                                    }}
                                                >
                                                    {/* Avatar com inicial */}
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        backgroundColor: 'var(--primary-100)',
                                                        color: 'var(--primary-700)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: '700',
                                                        fontSize: '0.875rem',
                                                        flexShrink: 0
                                                    }}>
                                                        {user.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    {/* Nome e e-mail */}
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{
                                                            fontWeight: '600',
                                                            fontSize: '0.875rem',
                                                            color: 'var(--text-primary)',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}>
                                                            {user.name}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.75rem',
                                                            color: 'var(--text-muted)',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}>
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Lista de participantes adicionados (chips removíveis) */}
                            {formData.participants.length > 0 && (
                                <div className="flex gap-sm" style={{ marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                    {formData.participants.map(email => (
                                        <span
                                            key={email}
                                            className="badge"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                backgroundColor: 'var(--primary-100)',
                                                color: 'var(--primary-700)'
                                            }}
                                        >
                                            <Mail size={12} />
                                            {email}
                                            <button
                                                type="button"
                                                onClick={() => removeParticipant(email)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--primary-700)',
                                                    padding: '0',
                                                    marginLeft: '2px'
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Mensagem de erro geral (submit) */}
                        {errors.submit && (
                            <div style={{
                                padding: 'var(--space-md)',
                                marginBottom: 'var(--space-md)',
                                backgroundColor: 'var(--error-light)',
                                borderRadius: 'var(--radius-md)',
                                color: '#b91c1c',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                {errors.submit}
                            </div>
                        )}

                        {/* Botão de submit */}
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={submitting}
                            style={{ width: '100%' }}
                        >
                            {submitting ? (
                                <>
                                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                    {isEditing ? 'Salvando...' : 'Agendando...'}
                                </>
                            ) : (
                                <>
                                    {isEditing ? 'Salvar Alterações' : 'Agendar Reunião'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default NewMeeting

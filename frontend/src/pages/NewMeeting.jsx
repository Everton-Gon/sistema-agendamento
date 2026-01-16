import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { meetingService } from '../services/meetingService'
import { roomService } from '../services/roomService'
import { useToast } from '../components/Common/Toast'
import { format, addHours, setHours, setMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    Calendar,
    Clock,
    Building2,
    Users,
    Plus,
    X,
    AlertCircle,
    CheckCircle,
    Loader
} from 'lucide-react'

function NewMeeting() {
    const navigate = useNavigate()
    const location = useLocation()
    const toast = useToast()
    const selectedDate = location.state?.selectedDate || new Date()

    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [checkingAvailability, setCheckingAvailability] = useState(false)
    const [availabilityStatus, setAvailabilityStatus] = useState(null)
    const [suggestedRooms, setSuggestedRooms] = useState([])

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        room_id: '',
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        attendees: []
    })

    const [newAttendee, setNewAttendee] = useState({ email: '', name: '' })
    const [errors, setErrors] = useState({})

    useEffect(() => {
        loadRooms()
    }, [])

    useEffect(() => {
        // Check availability when room, date, or time changes
        if (formData.room_id && formData.date && formData.start_time && formData.end_time) {
            checkAvailability()
        }
    }, [formData.room_id, formData.date, formData.start_time, formData.end_time])

    async function loadRooms() {
        try {
            const roomsData = await roomService.getRooms()
            setRooms(roomsData)
            if (roomsData.length > 0) {
                setFormData(prev => ({ ...prev, room_id: roomsData[0].id }))
            }
        } catch (error) {
            console.error('Error loading rooms:', error)
        } finally {
            setLoading(false)
        }
    }

    async function checkAvailability() {
        setCheckingAvailability(true)
        setAvailabilityStatus(null)
        setSuggestedRooms([])

        try {
            // Usar horário local diretamente
            const startStr = `${formData.date}T${formData.start_time}:00`
            const endStr = `${formData.date}T${formData.end_time}:00`

            const result = await meetingService.checkAvailability(
                formData.room_id,
                startStr,
                endStr
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

    const handleChange = (e) => {
        const { name, value } = e.target
        const newValue = name === 'room_id' ? parseInt(value) : value
        setFormData(prev => ({ ...prev, [name]: newValue }))
        setErrors(prev => ({ ...prev, [name]: '' }))
    }

    const addAttendee = () => {
        if (!newAttendee.email) return

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(newAttendee.email)) {
            setErrors(prev => ({ ...prev, attendee: 'Email inválido' }))
            return
        }

        if (formData.attendees.some(a => a.email === newAttendee.email)) {
            setErrors(prev => ({ ...prev, attendee: 'Participante já adicionado' }))
            return
        }

        setFormData(prev => ({
            ...prev,
            attendees: [...prev.attendees, { ...newAttendee, status: 'pending' }]
        }))
        setNewAttendee({ email: '', name: '' })
        setErrors(prev => ({ ...prev, attendee: '' }))
    }

    const removeAttendee = (email) => {
        setFormData(prev => ({
            ...prev,
            attendees: prev.attendees.filter(a => a.email !== email)
        }))
    }

    const selectSuggestedRoom = (roomId) => {
        setFormData(prev => ({ ...prev, room_id: roomId }))
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.title.trim()) {
            newErrors.title = 'Título é obrigatório'
        }

        if (!formData.room_id) {
            newErrors.room_id = 'Selecione uma sala'
        }

        if (!formData.date) {
            newErrors.date = 'Data é obrigatória'
        }

        if (!formData.start_time) {
            newErrors.start_time = 'Horário inicial é obrigatório'
        }

        if (!formData.end_time) {
            newErrors.end_time = 'Horário final é obrigatório'
        }

        if (formData.start_time >= formData.end_time) {
            newErrors.end_time = 'Horário final deve ser após o inicial'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validateForm()) return

        if (availabilityStatus?.type === 'error') {
            setErrors({ submit: 'Selecione um horário ou sala disponível' })
            return
        }

        setSubmitting(true)
        setErrors({})

        try {
            // Manter horário local (não converter para UTC)
            const startDateTime = `${formData.date}T${formData.start_time}:00`
            const endDateTime = `${formData.date}T${formData.end_time}:00`

            const meetingData = {
                title: formData.title,
                description: formData.description || null,
                room_id: formData.room_id,
                start_datetime: startDateTime,
                end_datetime: endDateTime,
                attendees: formData.attendees
            }

            await meetingService.createMeeting(meetingData)
            toast.success('Reunião agendada com sucesso! Os participantes serão notificados por e-mail.')
            navigate('/my-meetings', { state: { success: 'Reunião agendada com sucesso!' } })
        } catch (error) {
            console.error('Error creating meeting:', error)

            if (error.response?.status === 409) {
                const data = error.response.data.detail
                setErrors({ submit: data.message })
                setSuggestedRooms(data.available_rooms || [])
            } else {
                setErrors({ submit: 'Erro ao agendar reunião. Tente novamente.' })
            }
        } finally {
            setSubmitting(false)
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h1>Nova Reunião</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Preencha os dados para agendar uma nova reunião
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="card">
                    <div className="card-body flex flex-col gap-lg">
                        {/* Title */}
                        <div className="input-group">
                            <label className="input-label">Título da Reunião *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className={`input ${errors.title ? 'input-error' : ''}`}
                                placeholder="Ex: Reunião de planejamento semanal"
                            />
                            {errors.title && <span className="error-message">{errors.title}</span>}
                        </div>

                        {/* Description */}
                        <div className="input-group">
                            <label className="input-label">Descrição</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                className="input textarea"
                                placeholder="Pauta ou descrição da reunião (opcional)"
                                rows={3}
                            />
                        </div>

                        {/* Room Selection */}
                        <div className="input-group">
                            <label className="input-label">Sala *</label>
                            <select
                                name="room_id"
                                value={formData.room_id}
                                onChange={handleChange}
                                className={`input select ${errors.room_id ? 'input-error' : ''}`}
                            >
                                {rooms.map(room => (
                                    <option key={room.id} value={room.id}>
                                        {room.name} (Capacidade: {room.capacity} pessoas)
                                    </option>
                                ))}
                            </select>
                            {errors.room_id && <span className="error-message">{errors.room_id}</span>}

                            {/* Room info */}
                            {formData.room_id && (
                                <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                                    {rooms.find(r => r.id === parseInt(formData.room_id))?.resources?.map(resource => (
                                        <span key={resource} className="badge badge-primary">
                                            {resource}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date and Time */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 'var(--space-md)'
                        }}>
                            <div className="input-group">
                                <label className="input-label">Data *</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    className={`input ${errors.date ? 'input-error' : ''}`}
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                />
                                {errors.date && <span className="error-message">{errors.date}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Início *</label>
                                <input
                                    type="time"
                                    name="start_time"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                    className={`input ${errors.start_time ? 'input-error' : ''}`}
                                />
                                {errors.start_time && <span className="error-message">{errors.start_time}</span>}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Término *</label>
                                <input
                                    type="time"
                                    name="end_time"
                                    value={formData.end_time}
                                    onChange={handleChange}
                                    className={`input ${errors.end_time ? 'input-error' : ''}`}
                                />
                                {errors.end_time && <span className="error-message">{errors.end_time}</span>}
                            </div>
                        </div>

                        {/* Availability Status */}
                        {checkingAvailability && (
                            <div className="flex items-center gap-sm" style={{ color: 'var(--text-secondary)' }}>
                                <Loader size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                                <span className="text-sm">Verificando disponibilidade...</span>
                            </div>
                        )}

                        {availabilityStatus && !checkingAvailability && (
                            <div style={{
                                padding: 'var(--space-md)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: availabilityStatus.type === 'success' ? 'var(--success-light)' : 'var(--error-light)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 'var(--space-sm)'
                            }}>
                                {availabilityStatus.type === 'success' ? (
                                    <CheckCircle size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
                                ) : (
                                    <AlertCircle size={20} style={{ color: 'var(--error)', flexShrink: 0 }} />
                                )}
                                <div style={{ flex: 1 }}>
                                    <p className="font-medium" style={{
                                        color: availabilityStatus.type === 'success' ? '#15803d' : '#b91c1c'
                                    }}>
                                        {availabilityStatus.message}
                                    </p>

                                    {/* Suggested Rooms */}
                                    {suggestedRooms.length > 0 && (
                                        <div style={{ marginTop: 'var(--space-sm)' }}>
                                            <p className="text-sm" style={{ marginBottom: 'var(--space-xs)' }}>
                                                Salas disponíveis neste horário:
                                            </p>
                                            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                                                {suggestedRooms.map(room => (
                                                    <button
                                                        key={room.id}
                                                        type="button"
                                                        onClick={() => selectSuggestedRoom(room.id)}
                                                        className="btn btn-sm"
                                                        style={{
                                                            backgroundColor: room.color + '20',
                                                            color: room.color,
                                                            border: `1px solid ${room.color}`
                                                        }}
                                                    >
                                                        {room.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Attendees */}
                        <div className="input-group">
                            <label className="input-label">Participantes</label>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr auto',
                                gap: 'var(--space-sm)'
                            }}>
                                <input
                                    type="email"
                                    value={newAttendee.email}
                                    onChange={(e) => setNewAttendee(prev => ({ ...prev, email: e.target.value }))}
                                    className="input"
                                    placeholder="email@exemplo.com"
                                />
                                <input
                                    type="text"
                                    value={newAttendee.name}
                                    onChange={(e) => setNewAttendee(prev => ({ ...prev, name: e.target.value }))}
                                    className="input"
                                    placeholder="Nome (opcional)"
                                />
                                <button
                                    type="button"
                                    onClick={addAttendee}
                                    className="btn btn-secondary btn-icon"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                            {errors.attendee && <span className="error-message">{errors.attendee}</span>}

                            {/* Attendees List */}
                            {formData.attendees.length > 0 && (
                                <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                                    {formData.attendees.map(attendee => (
                                        <span
                                            key={attendee.email}
                                            className="badge badge-primary"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-xs)'
                                            }}
                                        >
                                            <Users size={12} />
                                            {attendee.name || attendee.email}
                                            <button
                                                type="button"
                                                onClick={() => removeAttendee(attendee.email)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    display: 'flex'
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit Error */}
                        {errors.submit && (
                            <div style={{
                                padding: 'var(--space-md)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--error-light)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-sm)',
                                color: '#b91c1c'
                            }}>
                                <AlertCircle size={20} />
                                <span>{errors.submit}</span>
                            </div>
                        )}
                    </div>

                    <div className="card-footer flex justify-between">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="btn btn-secondary"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting || availabilityStatus?.type === 'error'}
                        >
                            {submitting ? (
                                <>
                                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                                    Agendando...
                                </>
                            ) : (
                                <>
                                    <Calendar size={18} />
                                    Agendar Reunião
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}

export default NewMeeting

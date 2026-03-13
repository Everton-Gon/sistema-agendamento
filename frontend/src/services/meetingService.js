/**
 * =============================================================
 *   meetingService.js — Serviço de reuniões (API client)
 * =============================================================
 *   Responsável por:
 *   - Comunicar com o backend para CRUD de reuniões
 *   - Buscar eventos do calendário para exibição
 *   - Verificar disponibilidade de salas em tempo real
 *   - Buscar agenda de uma sala específica
 *   
 *   Todos os métodos são assíncronos e retornam dados do backend.
 *   Usa a instância do Axios configurada em api.js.
 * =============================================================
 */

import api from './api'

export const meetingService = {
    /**
     * Busca todas as reuniões do usuário logado.
     * Aceita filtros opcionais de data (início e fim).
     * Usado na página "Minhas Reuniões" e no Dashboard.
     * 
     * @param {string|null} startDate - Data inicial (ISO 8601) para filtrar
     * @param {string|null} endDate - Data final (ISO 8601) para filtrar
     * @returns {Array} Lista de reuniões do usuário
     */
    async getMeetings(startDate = null, endDate = null) {
        const params = new URLSearchParams()
        if (startDate) params.append('start_date', startDate)
        if (endDate) params.append('end_date', endDate)

        const response = await api.get(`/api/meetings?${params.toString()}`)
        return response.data
    },

    /**
     * Busca eventos do calendário em um período para exibição.
     * Aceita objetos Date ou strings ISO — converte automaticamente.
     * Usado na página de Calendário para renderizar os eventos visuais.
     * 
     * @param {Date|string} start - Início do período
     * @param {Date|string} end - Fim do período
     * @returns {Array} Lista de eventos formatados para o calendário
     */
    async getCalendarEvents(start, end) {
        // Converte Date para ISO string se necessário
        const startStr = start instanceof Date ? start.toISOString() : start
        const endStr = end instanceof Date ? end.toISOString() : end

        const response = await api.get('/api/meetings/calendar', {
            params: { start: startStr, end: endStr }
        })
        return response.data
    },

    /**
     * Busca detalhes de uma reunião específica pelo ID.
     * Inclui participantes, sala, organizador e link do Teams.
     * 
     * @param {number} id - ID da reunião
     * @returns {Object} Dados completos da reunião
     */
    async getMeeting(id) {
        const response = await api.get(`/api/meetings/${id}`)
        return response.data
    },

    /**
     * Cria uma nova reunião.
     * Envia dados ao backend que irá:
     * 1. Verificar conflitos de horário (banco local + Outlook)
     * 2. Criar a reunião no banco de dados
     * 3. Criar evento no calendário do Outlook/Teams
     * 4. Enviar convites por e-mail aos participantes
     * 
     * @param {Object} meetingData - Dados da reunião (title, room_id, start_datetime, end_datetime, attendees)
     * @returns {Object} Reunião criada com ID, link do Teams, etc
     */
    async createMeeting(meetingData) {
        const response = await api.post('/api/meetings', meetingData)
        return response.data
    },

    /**
     * Atualiza uma reunião existente.
     * Permite alterar título, descrição, horário e participantes.
     * 
     * @param {number} id - ID da reunião a atualizar
     * @param {Object} meetingData - Novos dados
     * @returns {Object} Reunião atualizada
     */
    async updateMeeting(id, meetingData) {
        const response = await api.put(`/api/meetings/${id}`, meetingData)
        return response.data
    },

    /**
     * Cancela uma reunião (soft delete — muda status para "cancelada").
     * O backend também cancela o evento no Outlook/Teams e notifica participantes.
     * 
     * @param {number} id - ID da reunião a cancelar
     * @returns {Object} Confirmação do cancelamento
     */
    async cancelMeeting(id) {
        const response = await api.delete(`/api/meetings/${id}`)
        return response.data
    },

    /**
     * Verifica disponibilidade de uma sala em um horário.
     * Consulta tanto o banco de dados local quanto o calendário do Outlook.
     * Usado em tempo real no formulário de nova reunião.
     * 
     * Se indisponível, retorna lista de salas alternativas.
     * 
     * @param {number} roomId - ID da sala a verificar
     * @param {Date|string} start - Início do horário desejado
     * @param {Date|string} end - Fim do horário desejado
     * @param {number|null} meetingId - ID da reunião atual (ignorada na verificação ao editar)
     * @returns {Object} { is_available, conflict?, available_rooms? }
     */
    async checkAvailability(roomId, start, end, meetingId = null) {
        const startStr = start instanceof Date ? start.toISOString() : start
        const endStr = end instanceof Date ? end.toISOString() : end

        const params = new URLSearchParams({
            room_id: roomId,
            start: startStr,
            end: endStr
        })
        if (meetingId) params.append('meeting_id', meetingId)

        const response = await api.get(`/api/meetings/check-availability?${params.toString()}`)
        return response.data
    },

    /**
     * Busca a agenda de uma sala específica para um dia.
     * Retorna todas as reuniões agendadas naquela sala no dia informado.
     * Usado na página de salas para ver ocupação.
     * 
     * @param {number} roomId - ID da sala
     * @param {Date|string} date - Data para consultar
     * @returns {Array} Lista de reuniões na sala naquele dia
     */
    async getRoomSchedule(roomId, date) {
        const dateStr = date instanceof Date ? date.toISOString() : date
        const response = await api.get(`/api/meetings/room/${roomId}/schedule`, {
            params: { date: dateStr }
        })
        return response.data
    }
}

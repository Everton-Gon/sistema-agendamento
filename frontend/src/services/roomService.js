/**
 * =============================================================
 *   roomService.js — Serviço de salas de reunião (API client)
 * =============================================================
 *   Responsável por:
 *   - Listar todas as salas de reunião disponíveis
 *   - Buscar detalhes de uma sala específica
 *   - Verificar disponibilidade de uma sala em um período
 *   - Listar salas disponíveis para um horário
 *   
 *   Usa a instância do Axios configurada em api.js.
 * =============================================================
 */

import api from './api'

export const roomService = {
    /**
     * Busca todas as salas de reunião cadastradas.
     * Retorna nome, capacidade, cor identificadora e recursos (TV, Webcam, etc.).
     * Usado na página de Salas e no formulário de nova reunião.
     * 
     * @returns {Array} Lista de salas com seus recursos
     */
    async getRooms() {
        const response = await api.get('/api/rooms')
        return response.data
    },

    /**
     * Busca detalhes de uma sala específica pelo ID.
     * 
     * @param {number} id - ID da sala
     * @returns {Object} Dados da sala (nome, capacidade, recursos, cor)
     */
    async getRoom(id) {
        const response = await api.get(`/api/rooms/${id}`)
        return response.data
    },

    /**
     * Verifica se uma sala está disponível em um período.
     * Converte as datas para ISO 8601 antes de enviar ao backend.
     * 
     * @param {number} roomId - ID da sala a verificar
     * @param {Date} start - Data/hora de início
     * @param {Date} end - Data/hora de fim
     * @returns {Object} { is_available, conflict? }
     */
    async checkRoomAvailability(roomId, start, end) {
        const response = await api.get(`/api/rooms/${roomId}/availability`, {
            params: {
                start: start.toISOString(),
                end: end.toISOString()
            }
        })
        return response.data
    },

    /**
     * Lista todas as salas disponíveis em um horário específico.
     * Útil para sugerir alternativas quando a sala desejada está ocupada.
     * 
     * @param {Date} start - Data/hora de início
     * @param {Date} end - Data/hora de fim
     * @returns {Array} Lista de salas sem conflito no período
     */
    async getAvailableRooms(start, end) {
        const response = await api.get('/api/rooms/available/list', {
            params: {
                start: start.toISOString(),
                end: end.toISOString()
            }
        })
        return response.data
    }
}

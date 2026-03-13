/**
 * =============================================================
 *   userService.js — Serviço de busca de usuários
 * =============================================================
 *   Usado pelo People Picker na tela de Nova Reunião.
 *   Busca usuários da Mallory por nome ou e-mail.
 * =============================================================
 */

import api from './api'

export const userService = {
    /**
     * Busca usuários por nome ou e-mail.
     * Ativado quando o usuário digita "@" na tela de participantes.
     *
     * @param {string} query - Texto digitado após o "@"
     * @returns {Array} Lista de { name, email }
     */
    async searchUsers(query) {
        if (!query || query.length < 2) return []

        try {
            const response = await api.get('/api/auth/users/search', {
                params: { q: query }
            })
            return response.data
        } catch (error) {
            console.error('Erro ao buscar usuários:', error)
            return []
        }
    }
}

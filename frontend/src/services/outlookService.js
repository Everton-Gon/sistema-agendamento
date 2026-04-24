/**
 * =============================================================
 *   outlookService.js — Calendário pessoal do usuário via Graph API
 * =============================================================
 *   Responsável por:
 *   - Buscar eventos do calendário pessoal do usuário logado
 *   - Cancelar eventos onde o usuário é ORGANIZADOR
 *   - Recusar eventos onde o usuário é PARTICIPANTE
 *   - Normalizar o formato dos eventos do Outlook para o padrão do sistema
 *
 *   Tecnologia:
 *   - Usa o token MSAL do usuário já logado (sem pedir login novamente)
 *   - Chama a Microsoft Graph API diretamente do frontend
 *   - Endpoint base: https://graph.microsoft.com/v1.0/me/
 *
 *   Permissões necessárias (já configuradas no msalConfig.js):
 *   - Calendars.ReadWrite — ler e modificar o calendário do usuário
 * =============================================================
 */

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

// Escopo para acesso ao calendário (já configurado no msalConfig.js)
const CALENDAR_SCOPES = ['Calendars.ReadWrite']

/**
 * Obtém um token de acesso para a Graph API usando o usuário já autenticado.
 * Tenta silenciosamente primeiro — se não conseguir, tenta com popup.
 *
 * @param {PublicClientApplication} msalInstance - Instância do MSAL
 * @returns {string|null} Access token ou null se falhar
 */
async function getGraphToken(msalInstance) {
    const accounts = msalInstance.getAllAccounts()

    if (!accounts || accounts.length === 0) {
        console.warn('[outlookService] Nenhuma conta Microsoft logada no MSAL')
        return null
    }

    // Usa a primeira conta disponível
    const account = accounts[0]

    try {
        // Tenta adquirir token silenciosamente (usa cache do MSAL)
        const result = await msalInstance.acquireTokenSilent({
            scopes: CALENDAR_SCOPES,
            account
        })
        return result.accessToken
    } catch (silentError) {
        console.warn('[outlookService] Token silencioso falhou, tentando popup:', silentError.message)
        try {
            // Fallback: popup de consentimento (exige interação do usuário)
            const result = await msalInstance.acquireTokenPopup({
                scopes: CALENDAR_SCOPES,
                account
            })
            return result.accessToken
        } catch (popupError) {
            console.error('[outlookService] Não foi possível obter token do Calendar:', popupError.message)
            return null
        }
    }
}

/**
 * Normaliza um evento do formato Microsoft Graph para o formato padrão do sistema.
 *
 * O formato do Graph API é diferente das reuniões locais — esta função converte
 * para um objeto comum usado em Dashboard e MyMeetings.
 *
 * @param {Object} event - Evento bruto retornado pelo Graph API
 * @param {string} userEmail - E-mail do usuário logado (para detectar papel)
 * @returns {Object} Evento normalizado no formato do sistema
 */
function normalizeOutlookEvent(event, userEmail) {
    const organizerEmail = event.organizer?.emailAddress?.address?.toLowerCase() || ''
    const isOrganizer = userEmail?.toLowerCase() === organizerEmail

    // Detecta link do Teams
    const teamsLink = event.onlineMeeting?.joinUrl || null

    // Detecta nome do local/sala
    const locationName = event.location?.displayName || null

    // Normaliza participantes
    const attendees = (event.attendees || []).map(att => ({
        email: att.emailAddress?.address || '',
        name: att.emailAddress?.name || '',
        status: att.status?.response || 'none' // none, accepted, declined, tentativelyAccepted
    }))

    return {
        // Identificação
        id: null,                              // Sem ID local (não está no banco)
        outlook_event_id: event.id,            // ID do Graph API — usado para cancelar/recusar

        // Dados da reunião
        title: event.subject || 'Sem título',
        description: event.bodyPreview || null,
        start_datetime: event.start?.dateTime, // "2024-01-15T14:00:00" (já em America/Sao_Paulo)
        end_datetime: event.end?.dateTime,

        // Sala/localização
        room_name: locationName || 'Outlook',
        room_color: '#6366f1',                 // Cor padrão para eventos externos

        // Organizador
        organizer_email: organizerEmail,
        organizer_name: event.organizer?.emailAddress?.name || organizerEmail,

        // Participantes
        attendees,

        // Teams
        teams_link: teamsLink,

        // Controle
        source: 'outlook',                     // Identifica que veio do Outlook
        is_organizer: isOrganizer,             // true = pode cancelar; false = pode recusar
        created_at: event.createdDateTime || new Date().toISOString(),

        // Campos extras do Outlook
        is_online_meeting: event.isOnlineMeeting || false,
        is_cancelled: event.isCancelled || false,
        response_status: event.responseStatus?.response || 'none'
    }
}

/**
 * Deduplica eventos do Outlook que já existem no banco local do sistema.
 *
 * O sistema cria reuniões no Outlook incluindo o organizador como participante.
 * Isso faz a reunião aparecer dos dois lados. A deduplicação evita que
 * o usuário veja a mesma reunião duas vezes.
 *
 * Critério: se há uma reunião local com mesmo início (primeiros 16 chars = "YYYY-MM-DDTHH:mm")
 * e título parecido (case-insensitive), o evento Outlook é removido.
 *
 * @param {Array} outlookEvents - Eventos vindos do Outlook (normalizados)
 * @param {Array} localMeetings - Reuniões locais do banco
 * @returns {Array} Apenas eventos do Outlook que NÃO existem localmente
 */
function deduplicateOutlookEvents(outlookEvents, localMeetings) {
    if (!localMeetings || localMeetings.length === 0) return outlookEvents

    // Cria um set de chaves das reuniões locais para busca rápida
    const localKeys = new Set(
        localMeetings.map(m => {
            const start = (m.start_datetime || '').substring(0, 16) // "YYYY-MM-DDTHH:mm"
            const title = (m.title || '').toLowerCase().trim()
            return `${start}|${title}`
        })
    )

    return outlookEvents.filter(evt => {
        const start = (evt.start_datetime || '').substring(0, 16)
        const title = (evt.title || '').toLowerCase().trim()
        const key = `${start}|${title}`
        return !localKeys.has(key)
    })
}

export const outlookService = {
    /**
     * Busca eventos do calendário pessoal do usuário logado no Outlook/Teams.
     *
     * Usa o endpoint /me/calendarView que retorna todos os eventos (incluindo
     * os criados pelo próprio sistema que o usuário aparece como participante).
     *
     * @param {PublicClientApplication} msalInstance - Instância do MSAL
     * @param {string} userEmail - E-mail do usuário logado
     * @param {Date} start - Data/hora de início do período
     * @param {Date} end - Data/hora de fim do período
     * @param {Array} localMeetings - Reuniões locais para deduplicação (opcional)
     * @returns {Array} Lista de eventos normalizados e deduplicados
     */
    async getUserCalendarEvents(msalInstance, userEmail, start, end, localMeetings = []) {
        const token = await getGraphToken(msalInstance)
        if (!token) return []

        // Formata as datas no formato ISO 8601 requerido pela Graph API
        const startStr = (start instanceof Date ? start : new Date(start)).toISOString()
        const endStr = (end instanceof Date ? end : new Date(end)).toISOString()

        // calendarView expande reuniões recorrentes em ocorrências individuais
        // $orderby requer que startDateTime e endDateTime também sejam selecionados
        const url = (
            `${GRAPH_API_BASE}/me/calendarView` +
            `?startDateTime=${encodeURIComponent(startStr)}` +
            `&endDateTime=${encodeURIComponent(endStr)}` +
            `&$select=id,subject,start,end,organizer,attendees,location,` +
            `isOnlineMeeting,onlineMeeting,isCancelled,responseStatus,bodyPreview,createdDateTime` +
            `&$orderby=start/dateTime` +
            `&$top=100`
        )

        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Prefer: 'outlook.timezone="America/Sao_Paulo"' // Retorna horas no fuso de Brasília
                }
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('[outlookService] Erro ao buscar eventos:', error)
                return []
            }

            const data = await response.json()
            const events = (data.value || [])
                .filter(e => !e.isCancelled) // Remove eventos já cancelados
                .map(e => normalizeOutlookEvent(e, userEmail))

            // Remove eventos que já existem no banco local
            const unique = deduplicateOutlookEvents(events, localMeetings)
            console.log(`[outlookService] ${events.length} eventos, ${unique.length} únicos (após dedup)`)
            return unique

        } catch (err) {
            console.error('[outlookService] Erro na chamada à Graph API:', err)
            return []
        }
    },

    /**
     * Cancela um evento do Outlook onde o usuário é ORGANIZADOR.
     *
     * DELETE /me/events/{eventId}
     * O Microsoft 365 notifica automaticamente todos os participantes
     * enviando um e-mail de cancelamento.
     *
     * @param {PublicClientApplication} msalInstance - Instância do MSAL
     * @param {string} eventId - ID do evento no Graph API (outlook_event_id)
     * @returns {boolean} true se cancelou com sucesso
     */
    async cancelOutlookEvent(msalInstance, eventId) {
        const token = await getGraphToken(msalInstance)
        if (!token) return false

        try {
            const response = await fetch(`${GRAPH_API_BASE}/me/events/${eventId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            if (response.status === 204) {
                console.log('[outlookService] Evento cancelado com sucesso')
                return true
            }

            const error = await response.json()
            console.error('[outlookService] Erro ao cancelar evento:', error)
            return false

        } catch (err) {
            console.error('[outlookService] Erro ao cancelar evento Outlook:', err)
            return false
        }
    },

    /**
     * Recusa um evento do Outlook onde o usuário é PARTICIPANTE.
     *
     * POST /me/events/{eventId}/decline
     * Remove o evento do calendário do usuário mas NÃO cancela para os outros.
     * O organizador recebe notificação de que o usuário recusou.
     *
     * @param {PublicClientApplication} msalInstance - Instância do MSAL
     * @param {string} eventId - ID do evento no Graph API (outlook_event_id)
     * @param {string} comment - Motivo do declínio (opcional)
     * @returns {boolean} true se recusou com sucesso
     */
    async declineOutlookEvent(msalInstance, eventId, comment = '') {
        const token = await getGraphToken(msalInstance)
        if (!token) return false

        try {
            const response = await fetch(`${GRAPH_API_BASE}/me/events/${eventId}/decline`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sendResponse: true,       // Notifica o organizador
                    comment: comment || ''    // Mensagem opcional
                })
            })

            if (response.status === 202) { // 202 Accepted
                console.log('[outlookService] Evento recusado com sucesso')
                return true
            }

            const error = await response.json()
            console.error('[outlookService] Erro ao recusar evento:', error)
            return false

        } catch (err) {
            console.error('[outlookService] Erro ao recusar evento Outlook:', err)
            return false
        }
    },

    /**
     * Aceita um evento do Outlook onde o usuário é PARTICIPANTE.
     *
     * POST /me/events/{eventId}/accept
     * Marca o evento como aceito no calendário do usuário.
     * O organizador recebe notificação de que o usuário aceitou.
     *
     * @param {PublicClientApplication} msalInstance - Instância do MSAL
     * @param {string} eventId - ID do evento no Graph API (outlook_event_id)
     * @returns {boolean} true se aceitou com sucesso
     */
    async acceptOutlookEvent(msalInstance, eventId) {
        const token = await getGraphToken(msalInstance)
        if (!token) return false

        try {
            const response = await fetch(`${GRAPH_API_BASE}/me/events/${eventId}/accept`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sendResponse: true  // Notifica o organizador
                })
            })

            if (response.status === 202) { // 202 Accepted
                console.log('[outlookService] Evento aceito com sucesso')
                return true
            }

            const error = await response.json()
            console.error('[outlookService] Erro ao aceitar evento:', error)
            return false

        } catch (err) {
            console.error('[outlookService] Erro ao aceitar evento Outlook:', err)
            return false
        }
    }
}

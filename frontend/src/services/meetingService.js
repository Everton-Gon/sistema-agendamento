import api from './api'

export const meetingService = {
    // Get all meetings for current user
    async getMeetings(startDate = null, endDate = null) {
        const params = new URLSearchParams()
        if (startDate) params.append('start_date', startDate)
        if (endDate) params.append('end_date', endDate)

        const response = await api.get(`/api/meetings?${params.toString()}`)
        return response.data
    },

    // Get calendar events for a date range
    async getCalendarEvents(start, end) {
        // Usar formato ISO local se for Date, ou string direta
        const startStr = start instanceof Date ? start.toISOString() : start
        const endStr = end instanceof Date ? end.toISOString() : end

        const response = await api.get('/api/meetings/calendar', {
            params: { start: startStr, end: endStr }
        })
        return response.data
    },

    // Get a single meeting
    async getMeeting(id) {
        const response = await api.get(`/api/meetings/${id}`)
        return response.data
    },

    // Create a new meeting
    async createMeeting(meetingData) {
        const response = await api.post('/api/meetings', meetingData)
        return response.data
    },

    // Update a meeting
    async updateMeeting(id, meetingData) {
        const response = await api.put(`/api/meetings/${id}`, meetingData)
        return response.data
    },

    // Cancel a meeting
    async cancelMeeting(id) {
        const response = await api.delete(`/api/meetings/${id}`)
        return response.data
    },

    // Check availability - aceita Date ou string
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

    // Get room schedule for a day
    async getRoomSchedule(roomId, date) {
        const dateStr = date instanceof Date ? date.toISOString() : date
        const response = await api.get(`/api/meetings/room/${roomId}/schedule`, {
            params: { date: dateStr }
        })
        return response.data
    }
}

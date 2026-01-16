import api from './api'

export const roomService = {
    // Get all rooms
    async getRooms() {
        const response = await api.get('/api/rooms')
        return response.data
    },

    // Get a single room
    async getRoom(id) {
        const response = await api.get(`/api/rooms/${id}`)
        return response.data
    },

    // Check room availability
    async checkRoomAvailability(roomId, start, end) {
        const response = await api.get(`/api/rooms/${roomId}/availability`, {
            params: {
                start: start.toISOString(),
                end: end.toISOString()
            }
        })
        return response.data
    },

    // Get available rooms for a time slot
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

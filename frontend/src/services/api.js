/**
 * =============================================================
 *   api.js — Configuração do cliente HTTP (Axios)
 * =============================================================
 *   Responsável por:
 *   - Criar instância do Axios com URL base do backend
 *   - Interceptar requisições para adicionar token JWT automaticamente
 *   - Interceptar respostas para tratar erros de autenticação (401)
 *   
 *   Como funciona:
 *   1. Toda chamada HTTP passa por aqui antes de ir ao backend
 *   2. O token JWT é lido do localStorage e adicionado ao header
 *   3. Se o backend retorna 401, o usuário é deslogado automaticamente
 * =============================================================
 */

import axios from 'axios'
import { apiConfig } from '../config/msalConfig'

// Cria instância do Axios com configuração base
// Todas as chamadas usam JSON e apontam para o backend FastAPI
const api = axios.create({
    baseURL: apiConfig.baseUrl,   // Ex: http://localhost:8000
    headers: {
        'Content-Type': 'application/json'
    }
})

/**
 * Interceptor de REQUISIÇÃO —
 * Antes de cada chamada HTTP, adiciona o token JWT no header Authorization.
 * Formato: "Bearer eyJhbG..."
 * O token é salvo no localStorage pelo AuthContext após o login.
 */
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

/**
 * Interceptor de RESPOSTA —
 * Se o backend retorna 401 (Unauthorized), significa que:
 * - O token JWT expirou (padrão: 60 minutos)
 * - O token é inválido ou foi adulterado
 * 
 * Ação: remove o token e redireciona para a tela de login.
 */
api.interceptors.response.use(
    (response) => response,       // Sucesso: retorna a resposta normalmente
    (error) => {
        if (error.response?.status === 401) {
            // Token expirado ou inválido — desloga o usuário
            localStorage.removeItem('token')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default api

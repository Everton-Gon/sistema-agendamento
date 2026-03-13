/**
 * =============================================================
 *   Toast.jsx — Sistema de notificações toast
 * =============================================================
 *   Responsável por:
 *   - Exibir notificações temporárias (success, error, warning, info)
 *   - Auto-remover após 5 segundos (configurável)
 *   - Permitir fechar manualmente clicando no X
 *   - Prover hook useToast() para uso em qualquer componente
 *   
 *   Como usar:
 *   const toast = useToast()
 *   toast.success('Reunião agendada com sucesso!')
 *   toast.error('Falha ao criar reunião')
 *   toast.warning('Sala indisponível')
 *   toast.info('Token expirado')
 * =============================================================
 */

import { useState, useEffect, createContext, useContext } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

// Contexto global de toasts — permite chamar de qualquer componente
const ToastContext = createContext(null)

/**
 * ToastProvider — Provider que gerencia a fila de notificações toast.
 * Deve envolver toda a aplicação (em main.jsx).
 * 
 * Cada toast tem: id, type (success/error/warning/info), title, message.
 * O toast é removido automaticamente após 5 segundos.
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])    // Fila de toasts ativos

    /**
     * Adiciona um novo toast à fila.
     * Gera um ID único baseado no timestamp.
     * Agenda remoção automática após a duração especificada.
     */
    const addToast = (toast) => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, ...toast }])

        // Remove automaticamente após 5 segundos (padrão)
        setTimeout(() => {
            removeToast(id)
        }, toast.duration || 5000)
    }

    /** Remove um toast da fila pelo ID */
    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    // API simplificada para criar toasts por tipo
    const toast = {
        success: (message, title = 'Sucesso') => addToast({ type: 'success', title, message }),
        error: (message, title = 'Erro') => addToast({ type: 'error', title, message }),
        warning: (message, title = 'Atenção') => addToast({ type: 'warning', title, message }),
        info: (message, title = 'Informação') => addToast({ type: 'info', title, message })
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {/* Renderiza o container de toasts no canto da tela */}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

/**
 * Hook para acessar o sistema de toasts.
 * Deve ser usado dentro de um ToastProvider.
 * 
 * @returns {Object} { success(), error(), warning(), info() }
 */
export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

/**
 * ToastContainer — Renderiza visualmente os toasts empilhados.
 * Cada toast tem ícone colorido, título, mensagem e botão fechar.
 * 
 * Cores por tipo:
 * - success: verde (var(--success))
 * - error: vermelho (var(--error))
 * - warning: amarelo (var(--warning))
 * - info: azul (var(--info))
 */
function ToastContainer({ toasts, onRemove }) {
    // Mapa de ícones por tipo de toast
    const icons = {
        success: CheckCircle,
        error: AlertCircle,
        warning: AlertTriangle,
        info: Info
    }

    return (
        <div className="toast-container">
            {toasts.map(toast => {
                const Icon = icons[toast.type] || Info
                return (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        {/* Ícone colorido por tipo */}
                        <Icon size={20} style={{
                            color: toast.type === 'success' ? 'var(--success)' :
                                toast.type === 'error' ? 'var(--error)' :
                                    toast.type === 'warning' ? 'var(--warning)' : 'var(--info)',
                            flexShrink: 0
                        }} />
                        {/* Conteúdo: título + mensagem */}
                        <div className="toast-content">
                            <div className="toast-title">{toast.title}</div>
                            <div className="toast-message">{toast.message}</div>
                        </div>
                        {/* Botão X para fechar manualmente */}
                        <button
                            className="modal-close"
                            onClick={() => onRemove(toast.id)}
                            style={{ marginLeft: 'auto' }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

export default ToastProvider

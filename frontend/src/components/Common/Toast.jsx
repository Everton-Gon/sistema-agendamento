import { useState, useEffect, createContext, useContext } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = (toast) => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, ...toast }])

        // Auto remove after 5 seconds
        setTimeout(() => {
            removeToast(id)
        }, toast.duration || 5000)
    }

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    const toast = {
        success: (message, title = 'Sucesso') => addToast({ type: 'success', title, message }),
        error: (message, title = 'Erro') => addToast({ type: 'error', title, message }),
        warning: (message, title = 'Atenção') => addToast({ type: 'warning', title, message }),
        info: (message, title = 'Informação') => addToast({ type: 'info', title, message })
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

function ToastContainer({ toasts, onRemove }) {
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
                        <Icon size={20} style={{
                            color: toast.type === 'success' ? 'var(--success)' :
                                toast.type === 'error' ? 'var(--error)' :
                                    toast.type === 'warning' ? 'var(--warning)' : 'var(--info)',
                            flexShrink: 0
                        }} />
                        <div className="toast-content">
                            <div className="toast-title">{toast.title}</div>
                            <div className="toast-message">{toast.message}</div>
                        </div>
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

/**
 * =============================================================
 *   Modal.jsx — Componente de modal reutilizável
 * =============================================================
 *   Responsável por:
 *   - Exibir conteúdo em overlay (fundo escuro)
 *   - Fechar com tecla Escape ou clicando fora do modal
 *   - Bloquear scroll da página enquanto aberto
 *   - Suportar tamanhos diferentes (default, lg)
 *   - Aceitar footer opcional para botões de ação
 *   
 *   Props:
 *   - isOpen: controla visibilidade
 *   - onClose: callback para fechar
 *   - title: título exibido no cabeçalho
 *   - children: conteúdo do corpo do modal
 *   - size: 'default' ou 'lg' (grande)
 *   - footer: JSX opcional para rodapé (botões)
 * =============================================================
 */

import { X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * Modal — Componente genérico de dialog/modal.
 * Fecha com Escape, clique no overlay ou botão X.
 */
function Modal({ isOpen, onClose, title, children, size = 'default', footer }) {
    /**
     * Efeito para:
     * 1. Fechar o modal ao pressionar Escape
     * 2. Bloquear scroll da página (overflow: hidden) enquanto aberto
     * 3. Limpar listeners ao fechar/desmontar
     */
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose()
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'    // Bloqueia scroll
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'     // Restaura scroll
        }
    }, [isOpen, onClose])

    // Não renderiza nada se o modal estiver fechado
    if (!isOpen) return null

    return (
        /* Overlay escuro — clicar nele fecha o modal */
        <div className="modal-overlay" onClick={onClose}>
            {/* Container do modal — stopPropagation impede fechar ao clicar dentro */}
            <div
                className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho: título + botão fechar (X) */}
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Corpo do modal — recebe qualquer conteúdo via children */}
                <div className="modal-body">
                    {children}
                </div>

                {/* Rodapé opcional — usado para botões de ação (Salvar, Cancelar) */}
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Modal

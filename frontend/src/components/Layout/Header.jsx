/**
 * =============================================================
 *   Header.jsx — Cabeçalho da aplicação
 * =============================================================
 *   Responsável por:
 *   - Exibir título "Sistema de Agendamento"
 *   - Mostrar avatar e dados do usuário logado (nome + email)
 *   - Botão hamburger para abrir sidebar no mobile
 *   - Botão de logout
 * =============================================================
 */

import { useAuth } from '../../contexts/AuthContext'
import { Menu, LogOut, User } from 'lucide-react'

/**
 * Header — Barra superior fixa da aplicação.
 * 
 * @param {function} onMenuClick - Callback para toggle da sidebar (mobile)
 */
function Header({ onMenuClick }) {
    const { user, logout } = useAuth()

    /**
     * Extrai as iniciais do nome para exibir no avatar.
     * Ex: "Everton Gonçalves" → "EG"
     * Limita a 2 caracteres em maiúsculo.
     */
    const getInitials = (name) => {
        if (!name) return 'U'
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

    }

    return (
        <header className="header">
            <div className="flex items-center gap-md">
                {/* Botão hamburger — visível apenas no mobile */}
                <button
                    className="btn btn-ghost btn-icon show-mobile"
                    onClick={onMenuClick}
                    aria-label="Abrir menu"
                >
                    <Menu size={24} />
                </button>
                {/* Título — oculto no mobile para economizar espaço */}
                <h1 className="header-title hide-mobile">Sistema de Agendamento</h1>
            </div>

            {/* Área direita: avatar + dados do usuário + botão logout */}
            <div className="header-actions">
                <div className="flex items-center gap-md">
                    {/* Avatar circular com iniciais do nome */}
                    <div className="avatar avatar-md" title={user?.name}>
                        {getInitials(user?.name)}
                    </div>
                    {/* Nome e email — ocultos no mobile */}
                    <div className="hide-mobile">
                        <p className="font-medium text-sm">{user?.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {user?.email}
                        </p>
                    </div>
                </div>

                {/* Botão de logout — remove token e redireciona para login */}
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={logout}
                    title="Sair"
                >
                    <LogOut size={20} />
                </button>

            </div>
            {/* <div className="header-actions">
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={backPage}
                    title="Voltar"
                >
                    <ChevronLeft size={20} />
                </button>                
            </div>     */}
        </header>
    )
}

export default Header

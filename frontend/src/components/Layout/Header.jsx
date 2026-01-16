import { useAuth } from '../../contexts/AuthContext'
import { Menu, LogOut, User } from 'lucide-react'

function Header({ onMenuClick }) {
    const { user, logout } = useAuth()

    const getInitials = (name) => {
        if (!name) return 'U'
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    }

    return (
        <header className="header">
            <div className="flex items-center gap-md">
                <button
                    className="btn btn-ghost btn-icon show-mobile"
                    onClick={onMenuClick}
                    aria-label="Abrir menu"
                >
                    <Menu size={24} />
                </button>
                <h1 className="header-title hide-mobile">Sistema de Agendamento</h1>
            </div>

            <div className="header-actions">
                <div className="flex items-center gap-md">
                    <div className="avatar avatar-md" title={user?.name}>
                        {getInitials(user?.name)}
                    </div>
                    <div className="hide-mobile">
                        <p className="font-medium text-sm">{user?.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {user?.email}
                        </p>
                    </div>
                </div>

                <button
                    className="btn btn-ghost btn-icon"
                    onClick={logout}
                    title="Sair"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    )
}

export default Header

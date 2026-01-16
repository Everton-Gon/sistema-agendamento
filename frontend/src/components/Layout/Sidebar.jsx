import { NavLink } from 'react-router-dom'
import {
    Calendar,
    Plus,
    List,
    Building2,
    LayoutDashboard,
    CalendarDays
} from 'lucide-react'

function Sidebar({ isOpen, onClose }) {
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/calendar', icon: CalendarDays, label: 'Calendário' },
        { path: '/new-meeting', icon: Plus, label: 'Nova Reunião' },
        { path: '/my-meetings', icon: List, label: 'Minhas Reuniões' },
        { path: '/rooms', icon: Building2, label: 'Salas' },
    ]

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <Calendar size={24} />
                    </div>
                    <span className="sidebar-logo-text hide-mobile">Agendamento</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? 'active' : ''}`
                        }
                        onClick={onClose}
                        end={item.path === '/'}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    © 2026 Sistema de Agendamento
                </p>
            </div>
        </aside>
    )
}

export default Sidebar

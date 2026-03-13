/**
 * =============================================================
 *   Sidebar.jsx — Menu lateral de navegação
 * =============================================================
 *   Responsável por:
 *   - Exibir os links de navegação da aplicação
 *   - Destacar a rota ativa com classe CSS 'active'
 *   - Fechar automaticamente no mobile ao clicar em um link
 *   - Exibir logo e copyright no rodapé
 *   
 *   Itens do menu:
 *   Dashboard → Calendário → Nova Reunião → Minhas Reuniões → Salas
 * =============================================================
 */

import { NavLink } from 'react-router-dom'
import {
    Calendar,
    Plus,
    List,
    Building2,
    LayoutDashboard,
    CalendarDays
} from 'lucide-react'

/**
 * Sidebar — Componente do menu lateral.
 * 
 * @param {boolean} isOpen - Controla visibilidade no mobile (toggle)
 * @param {function} onClose - Callback para fechar a sidebar ao clicar em um link
 */
function Sidebar({ isOpen, onClose }) {
    // Definição dos itens de navegação (ícone + rota + label)
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },        // Página inicial
        { path: '/calendar', icon: CalendarDays, label: 'Calendário' },  // Visualização mensal
        { path: '/new-meeting', icon: Plus, label: 'Nova Reunião' },      // Formulário de criação
        { path: '/my-meetings', icon: List, label: 'Minhas Reuniões' },  // Lista de reuniões
        { path: '/rooms', icon: Building2, label: 'Salas' },             // Gerenciamento de salas
    ]

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Cabeçalho com logo */}
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <Calendar size={24} />
                    </div>
                    {/* Texto oculto no mobile para economizar espaço */}
                    <span className="sidebar-logo-text hide-mobile">Agendamento</span>
                </div>
            </div>

            {/* Links de navegação — NavLink aplica classe 'active' automaticamente */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? 'active' : ''}`
                        }
                        onClick={onClose}       // Fecha sidebar no mobile ao navegar
                        end={item.path === '/'}  // 'end' evita que "/" se destaque em todas as rotas
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Rodapé com copyright */}
            <div className="sidebar-footer">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    © 2026 Sistema de Agendamento
                </p>
            </div>
        </aside>
    )
}

export default Sidebar

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
    CalendarDays,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'

/**
 * Sidebar — Componente do menu lateral.
 * 
 * @param {boolean} isOpen - Controla visibilidade no mobile (toggle)
 * @param {function} onClose - Callback para fechar a sidebar ao clicar em um link
 */
function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
    // Definição dos itens de navegação (ícone + rota + label)
    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },        // Página inicial
        { path: '/calendar', icon: CalendarDays, label: 'Calendário' },  // Visualização mensal
        { path: '/new-meeting', icon: Plus, label: 'Nova Reunião' },      // Formulário de criação
        { path: '/my-meetings', icon: List, label: 'Minhas Reuniões' },  // Lista de reuniões
        { path: '/rooms', icon: Building2, label: 'Salas' },             // Gerenciamento de salas
    ]

    return (
        <aside
            className={`sidebar ${isOpen ? 'open' : ''}`}
            style={{
                width: collapsed ? '64px' : '240px',
                transition: 'width 0.3s ease',
                overflow: 'hidden'
            }}
        >
            {/* Cabeçalho com logo */}
            <div className="sidebar-header" style={{ justifyContent: 'flex-start' }}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <Calendar size={24} />
                    </div>
                    {/* Texto oculto quando recolhido ou no mobile */}
                    {!collapsed && (
                        <span className="sidebar-logo-text hide-mobile">Agendamento</span>
                    )}
                </div>
            </div>

            {/* Nova linha de ações: Voltar + Recolher */}
            <div
                className="hide-mobile"
                style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-color)'
                }}
            >
                {/* Botão Voltar — escondido quando recolhido */}
                {!collapsed && (
                    <button
                        onClick={() => window.history.back()}
                        title="Voltar"
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text-primary)',
                            fontWeight: 500
                        }}
                    >
                        <ChevronLeft size={15} />
                        Voltar
                    </button>
                )}

                {/* Botão Recolher/Expandir */}
                <button
                    onClick={onToggleCollapse}
                    title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        flexShrink: 0
                    }}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
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
                        onClick={onClose}
                        end={item.path === '/'}
                        title={collapsed ? item.label : undefined}
                        style={{ justifyContent: collapsed ? 'center' : undefined }}
                    >
                        <item.icon size={20} />
                        {/* Esconde o label quando recolhido */}
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Rodapé com copyright — oculto quando recolhido */}
            {!collapsed && (
                <div className="sidebar-footer">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        © 2026 Sistema de Agendamento
                    </p>
                </div>
            )}
        </aside>
    )
}

export default Sidebar

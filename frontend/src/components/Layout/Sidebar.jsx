/**
 * =============================================================
 *   Sidebar.jsx — Menu lateral de navegação
 * =============================================================
 *   Responsável por:
 *   - Exibir os links de navegação da aplicação
 *   - Destacar a rota ativa com classe CSS 'active'
 *   - Fechar automaticamente no mobile ao clicar em um link
 *   - Exibir logo e copyright no rodapé
 *   - Recolher/expandir com ícones de ação visíveis em ambos os estados
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
    ChevronRight,
    ArrowLeft,
} from 'lucide-react'

/**
 * Sidebar — Componente do menu lateral.
 *
 * @param {boolean}  isOpen           - Controla visibilidade no mobile (toggle)
 * @param {function} onClose          - Callback para fechar a sidebar ao clicar em um link
 * @param {boolean}  collapsed        - Se a sidebar está recolhida
 * @param {function} onToggleCollapse - Callback para alternar collapsed
 */
function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
    const navItems = [
        { path: '/',            icon: LayoutDashboard, label: 'Dashboard'       },
        { path: '/calendar',    icon: CalendarDays,    label: 'Calendário'      },
        { path: '/new-meeting', icon: Plus,            label: 'Nova Reunião'    },
        { path: '/my-meetings', icon: List,            label: 'Minhas Reuniões' },
        { path: '/rooms',       icon: Building2,       label: 'Salas'           },
    ]

    return (
        <aside
            className={`sidebar ${isOpen ? 'open' : ''}`}
            style={{
                width: collapsed ? '64px' : '240px',
                transition: 'width 0.3s ease',
                overflow: 'hidden',
            }}
        >
            {/* ── Cabeçalho com logo ── */}
            <div className="sidebar-header" style={{ justifyContent: 'flex-start' }}>
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        {/* <Calendar size={24} /> */}
                        <img src="/mallory-logo.png" alt="Logo" width={24} height={auto} />
                    </div>
                    {!collapsed && (
                        <span className="sidebar-logo-text hide-mobile">Agendamento</span>
                    )}
                </div>
            </div>

            {/* ── Barra de ações (Voltar + Toggle) ── */}
            <div
                className="hide-mobile"
                style={{
                    display: 'flex',
                    flexDirection: collapsed ? 'column' : 'row',
                    alignItems: 'center',
                    gap: '8px',
                    padding: collapsed ? '10px 0' : '10px 12px',
                    borderBottom: '1px solid var(--border-color)',
                }}
            >
                {collapsed ? (
                    /*
                     * Estado RECOLHIDO:
                     * Dois ícones empilhados verticalmente e centralizados.
                     * ← Voltar  (ArrowLeft)
                     * › Expandir (ChevronRight)
                     */
                    <>
                        {/* Botão Voltar (ícone) */}
                        <button
                            onClick={() => window.history.back()}
                            title="Voltar"
                            style={iconBtnStyle}
                        >
                            <ArrowLeft size={16} />
                        </button>

                        {/* Botão Expandir sidebar */}
                        <button
                            onClick={onToggleCollapse}
                            title="Expandir menu"
                            style={iconBtnStyle}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </>
                ) : (
                    /*
                     * Estado EXPANDIDO:
                     * Botão "← Voltar" + botão "‹" lado a lado.
                     */
                    <>
                        <button
                            onClick={() => window.history.back()}
                            title="Voltar"
                            style={backBtnStyle}
                        >
                            <ChevronLeft size={15} />
                            Voltar
                        </button>

                        <button
                            onClick={onToggleCollapse}
                            title="Recolher menu"
                            style={iconBtnStyle}
                        >
                            <ChevronLeft size={16} />
                        </button>
                    </>
                )}
            </div>

            {/* ── Links de navegação ── */}
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
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* ── Rodapé com copyright ── */}
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

/* ── Estilos reutilizáveis ── */

const iconBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    flexShrink: 0,
}

const backBtnStyle = {
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
    fontWeight: 500,
}

export default Sidebar

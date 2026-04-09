/**
 * =============================================================
 *   Layout.jsx — Layout principal da aplicação (autenticado)
 * =============================================================
 *   Responsável por:
 *   - Estruturar a página com Sidebar + Header + Conteúdo
 *   - Gerenciar abertura/fechamento da sidebar no mobile
 *   - Renderizar overlay escuro quando sidebar está aberta no mobile
 *   - Usar <Outlet> do React Router para renderizar a página ativa
 *   
 *   Estrutura visual:
 *   ┌─────────┬───────────────────────────┐
 *   │         │  Header (nome + logout)   │
 *   │ Sidebar ├───────────────────────────┤
 *   │ (menu)  │  Conteúdo (<Outlet>)      │
 *   │         │  (Dashboard, Calendar...) │
 *   └─────────┴───────────────────────────┘
 * =============================================================
 */

import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

function Layout() {
    // Controla visibilidade da sidebar no mobile (toggle via Header)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    // Controla se a sidebar está recolhida (apenas no desktop)
    const [collapsed, setCollapsed] = useState(false)
    // Detecta se é totem (800x1200)
    const isTotem = typeof window !== 'undefined' && window.innerWidth === 800 && window.innerHeight >= 1200;
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen)    // Alterna abrir/fechar no mobile
    const closeSidebar = () => setSidebarOpen(false)            // Fecha a sidebar
    const toggleCollapsed = () => setCollapsed(!collapsed)      // Recolhe/expande no desktop

    return (
        <div className="app-layout">
            {/* Sidebar — menu lateral de navegação */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={closeSidebar}
                collapsed={collapsed}
                onToggleCollapse={toggleCollapsed}
            />

            {/* Overlay escuro no mobile — clicando nele fecha a sidebar */}
            {sidebarOpen && (
                <div
                    className="sidebar-overlay show-mobile"
                    onClick={closeSidebar}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 199
                    }}
                />
            )}

            {/* Área principal — Header no topo + conteúdo da página */}
            {/* marginLeft acompanha a largura do sidebar com animação suave */}
            <div className="main-content" style={{
                marginLeft: isTotem ? '0' : (collapsed ? '64px' : undefined),
                transition: 'margin-left 0.3s ease'
            }}>
                <Header onMenuClick={toggleSidebar} />
                <main className="page-content">
                    {/* Outlet renderiza o componente da rota ativa */}
                    {/* Ex: "/" → Dashboard, "/calendar" → CalendarPage */}
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export default Layout

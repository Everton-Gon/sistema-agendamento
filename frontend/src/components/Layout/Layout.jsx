import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
    const closeSidebar = () => setSidebarOpen(false)

    return (
        <div className="app-layout">
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

            {/* Overlay for mobile */}
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

            <div className="main-content">
                <Header onMenuClick={toggleSidebar} />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export default Layout

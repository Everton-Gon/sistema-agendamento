/**
 * =============================================================
 *   main.jsx — Ponto de entrada da aplicação React
 * =============================================================
 *   Responsável por:
 *   - Renderizar o componente raiz no DOM
 *   - Configurar os providers globais (Router, Auth, Toast, Msal)
 *   - Ativar o React.StrictMode para detecção de problemas
 *   
 *   Hierarquia de providers:
 *   StrictMode → MsalProvider → BrowserRouter → AuthProvider → ToastProvider → App
 * =============================================================
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ToastProvider } from './components/Common/Toast.jsx'
import { msalConfig } from './services/authConfig.js'
import './index.css'

// Instância singleton do MSAL — gerencia tokens e estado de autenticação Microsoft
const msalInstance = new PublicClientApplication(msalConfig)

// Monta a árvore React no elemento #root do index.html
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {/* MsalProvider — habilita loginMicrosoft() em toda a aplicação */}
        <MsalProvider instance={msalInstance}>
            {/* BrowserRouter — habilita navegação por rotas (SPA) */}
            <BrowserRouter>
                {/* AuthProvider — gerencia estado de autenticação (login/logout) */}
                <AuthProvider>
                    {/* ToastProvider — sistema de notificações toast globais */}
                    <ToastProvider>
                        <App />
                    </ToastProvider>
                </AuthProvider>
            </BrowserRouter>
        </MsalProvider>
    </React.StrictMode>,
)

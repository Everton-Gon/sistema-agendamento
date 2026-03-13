/**
 * =============================================================
 *   msalConfig.js — Configuração do Microsoft Authentication
 * =============================================================
 *   Responsável por:
 *   - Configurar o MSAL (Microsoft Authentication Library)
 *   - Definir escopos de permissão para login via Azure AD
 *   - Configurar a URL base da API backend
 *   
 *   Variáveis de ambiente (.env do frontend):
 *   - VITE_MICROSOFT_CLIENT_ID: ID da aplicação no Azure AD
 *   - VITE_MICROSOFT_TENANT_ID: ID do tenant (organização)
 *   - VITE_MICROSOFT_REDIRECT_URI: URL de callback após login
 *   - VITE_API_URL: URL do backend FastAPI
 * =============================================================
 */

// Configuração do MSAL para autenticação via Azure AD
export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',       // ID da app registrada no Azure
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}`,  // Endpoint de login do tenant
        redirectUri: import.meta.env.VITE_MICROSOFT_REDIRECT_URI || 'http://localhost:5173/auth/callback',       // URL de redirecionamento após login
        postLogoutRedirectUri: '/',       // Redireciona para raiz após logout
        navigateToLoginRequestUrl: false  // Não navega automaticamente após login
    },
    cache: {
        cacheLocation: 'localStorage',     // Armazena tokens no localStorage (persiste entre abas)
        storeAuthStateInCookie: false       // Não usa cookies para estado de auth
    },
    system: {
        // Logger personalizado para debug de autenticação MSAL
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return    // Não loga informações pessoais (PII)
                switch (level) {
                    case 0: // Error — erros críticos de autenticação
                        console.error(message)
                        break
                    case 1: // Warning — avisos sobre tokens ou configuração
                        console.warn(message)
                        break
                    case 2: // Info — informações gerais do fluxo de auth
                        console.info(message)
                        break
                    case 3: // Verbose — detalhes técnicos (útil para debug)
                        console.debug(message)
                        break
                }
            }
        }
    }
}

// Escopos de permissão solicitados ao fazer login via Microsoft
export const loginRequest = {
    scopes: [
        'User.Read',           // Ler perfil do usuário logado
        'Calendars.ReadWrite', // Ler e criar eventos no calendário
        'Mail.Send',           // Enviar e-mails em nome do usuário
        'offline_access'       // Manter sessão ativa (refresh token)
    ]
}

// Configuração da API backend
export const apiConfig = {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000'  // URL do servidor FastAPI
}

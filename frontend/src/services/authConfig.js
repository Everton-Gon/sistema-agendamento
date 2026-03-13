/**
 * =============================================================
 *   authConfig.js — Configuração do MSAL (Microsoft Auth)
 * =============================================================
 *   Configura a biblioteca @azure/msal-browser para autenticar
 *   usuários com suas contas corporativas da Microsoft (Mallory).
 *
 *   Variáveis lidas do arquivo frontend/.env:
 *   - VITE_MICROSOFT_CLIENT_ID  → ID do App registrado no Azure
 *   - VITE_MICROSOFT_TENANT_ID  → ID do locatário (Mallory)
 *   - VITE_MICROSOFT_REDIRECT_URI → URL de retorno após login
 * =============================================================
 */

// Configuração principal da instância MSAL
export const msalConfig = {
    auth: {
        // ID do aplicativo registrado no Microsoft Entra ID (Azure AD)
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,

        // Endpoint de autorização — restrito ao tenant da Mallory (Single Tenant)
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID}`,

        // URL para onde a Microsoft redireciona após o login bem-sucedido
        redirectUri: import.meta.env.VITE_MICROSOFT_REDIRECT_URI || 'http://localhost:5173/',
    },
    cache: {
        // Armazena o token da Microsoft no sessionStorage (mais seguro que localStorage)
        // O token é apagado quando o usuário fecha a aba/browser
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
}

// Escopos de permissão solicitados ao fazer login
// - openid, profile, email: dados básicos do usuário (nome, e-mail)
// - User.Read: permissão para ler o perfil no Microsoft Graph
export const loginRequest = {
    scopes: ['openid', 'profile', 'email', 'User.Read'],
}

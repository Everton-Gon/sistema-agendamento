/**
 * =============================================================
 *   authConfig.js — Configuração do MSAL (Microsoft Auth)
 * =============================================================
 *   Configura a biblioteca @azure/msal-browser para autenticar
 *   usuários com suas contas corporativas da Microsoft.
 *
 *   Variáveis lidas do arquivo frontend/.env:
 *   - VITE_MICROSOFT_CLIENT_ID  → ID do App registrado no Azure
 *   - VITE_MICROSOFT_TENANT_ID  → ID do locatário (empresa)
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
        redirectUri: import.meta.env.VITE_MICROSOFT_REDIRECT_URI || 'https://dominio.com.br/',
    },
    cache: {
        // localStorage persiste durante redirecionamentos (ao contrário de sessionStorage
        // que é apagado no iOS Safari ao sair da página — causa do redirect não funcionar)
        cacheLocation: 'localStorage',
        // Fallback para cookies: garante que o estado do redirect sobrevive
        // em browsers que bloqueiam localStorage de terceiros
        storeAuthStateInCookie: true,
    },
}

// Escopos de permissão solicitados ao fazer login
// - openid, profile, email: dados básicos do usuário (nome, e-mail)
// - User.Read: permissão para ler o perfil no Microsoft Graph
export const loginRequest = {
    scopes: ['openid', 'profile', 'email', 'User.Read'],
}

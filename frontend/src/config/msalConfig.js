// Microsoft Authentication Library (MSAL) configuration
export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}`,
        redirectUri: import.meta.env.VITE_MICROSOFT_REDIRECT_URI || 'http://localhost:5173/auth/callback',
        postLogoutRedirectUri: '/',
        navigateToLoginRequestUrl: false
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return
                switch (level) {
                    case 0: // Error
                        console.error(message)
                        break
                    case 1: // Warning  
                        console.warn(message)
                        break
                    case 2: // Info
                        console.info(message)
                        break
                    case 3: // Verbose
                        console.debug(message)
                        break
                }
            }
        }
    }
}

// Login request scopes
export const loginRequest = {
    scopes: [
        'User.Read',
        'Calendars.ReadWrite',
        'Mail.Send',
        'offline_access'
    ]
}

// API configuration
export const apiConfig = {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000'
}

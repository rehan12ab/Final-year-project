// Singleton pattern for session management
// Ensures only one user session per browser

interface User {
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    subscription?: {
        plan: string;
        status: string;
    };
}

class SessionManager {
    private static instance: SessionManager;
    private currentUser: User | null = null;

    private constructor() {
        // Load user from localStorage on initialization
        this.loadSession();
    }

    static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    private loadSession(): void {
        const userStr = localStorage.getItem('hs_user');
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
            } catch (error) {
                console.error('Error loading session:', error);
                this.clearSession();
            }
        }
    }

    private clearSession(): void {
        this.currentUser = null;
        localStorage.removeItem('hs_user');
    }

    login(user: User, token: string): void {
        // Check if another session exists with different token
        const existingToken = localStorage.getItem('hs_auth_token');

        if (existingToken && existingToken !== token) {
            throw new Error('Another session is already active. Please logout first.');
        }

        this.currentUser = user;
        localStorage.setItem('hs_auth_token', token);
        localStorage.setItem('hs_user', JSON.stringify(user));
    }

    logout(): void {
        this.currentUser = null;
        localStorage.removeItem('hs_auth_token');
        localStorage.removeItem('hs_user');
    }

    getCurrentUser(): User | null {
        if (!this.currentUser) {
            this.loadSession();
        }
        return this.currentUser;
    }

    getToken(): string | null {
        return localStorage.getItem('hs_auth_token');
    }

    isAuthenticated(): boolean {
        return !!this.getToken() && !!this.getCurrentUser();
    }

    updateUser(user: Partial<User>): void {
        if (this.currentUser) {
            this.currentUser = { ...this.currentUser, ...user };
            localStorage.setItem('hs_user', JSON.stringify(this.currentUser));
        }
    }
}

export default SessionManager;

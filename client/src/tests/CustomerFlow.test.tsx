import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from '../App';
import { LoginModal } from '@/components/login-modal';

// Mocks
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockSetLocation = vi.fn();

// Mock useAuth to be dynamic
const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
    useAuth: () => mockUseAuth(),
    AuthProvider: ({ children }: any) => <>{children}</>
}));

// Mock BusinessContext
vi.mock('@/contexts/BusinessModeContext', () => ({
    BusinessModeProvider: ({ children }: any) => <>{children}</>,
    useBusinessMode: () => ({ businessUnit: null, setBusinessUnit: vi.fn() })
}));

// Shared state for mocks
const { sharedState } = vi.hoisted(() => ({
    sharedState: { currentPath: '/' }
}));

const navigate = (path: string) => {
    sharedState.currentPath = path;
    window.history.pushState({}, '', path);
};

vi.mock('wouter', async () => {
    return {
        useLocation: () => [sharedState.currentPath, mockSetLocation],
        Switch: ({ children }: any) => <>{children}</>,
        Route: ({ path, component: Component }: any) => {
            // Basic matching for test
            if (path === sharedState.currentPath) return <Component />;
            return null;
        },
        Link: ({ children, href }: any) => <a href={href} onClick={(e) => { e.preventDefault(); mockSetLocation(href); }}>{children}</a>
    };
});

// Mock Lazy Pages to avoid heavy loading and suspense issues
vi.mock('@/pages/lunch-menu', () => ({ default: () => <div data-testid="page-lunch-menu">Lunch Menu Page</div> }));
vi.mock('@/pages/customer-profile', () => ({ default: () => <div data-testid="page-profile">My Customer Profile</div> }));
vi.mock('@/pages/order-history', () => ({ default: () => <div data-testid="page-orders">My Orders Page</div> }));
vi.mock('@/pages/dashboard', () => ({ default: () => <div data-testid="page-dashboard">Dashboard</div> }));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: [], isLoading: false }),
    useMutation: () => ({ mutate: vi.fn() }),
    QueryClientProvider: ({ children }: any) => <>{children}</>,
    QueryClient: vi.fn(),
}));

// Mock Window matchMedia for PWA checks
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

describe('Customer Flow Regression Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue({
            isLoggedIn: false,
            currentStaff: null,
            login: mockLogin,
            logout: mockLogout
        });
        navigate('/lunch-menu');
        // Mock global fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Scenario 1: Customer Routing - Redirects to Profile and shows correct layout', async () => {
        // Setup: Logged in as Customer
        mockUseAuth.mockReturnValue({
            isLoggedIn: true,
            currentStaff: { role: 'customer', name: 'Test Customer' },
            login: mockLogin
        });

        // Action: User goes to /my-profile
        // Action: User goes to /my-profile
        navigate('/my-profile');

        // We need to verify `App` renders the Customer Profile
        // NOTE: App.tsx has its own Router logic inside.
        const { findByTestId } = render(<App />);

        // Assert
        expect(await findByTestId('page-profile', {}, { timeout: 2000 })).toBeTruthy();
        // Verify we didn't get redirected to login or dashboard
        expect(mockSetLocation).not.toHaveBeenCalledWith('/');
    });

    it('Scenario 2: Login Logic - Submits successfully and redirects', async () => {
        // Setup: Not logged in initially
        mockUseAuth.mockReturnValue({
            isLoggedIn: false,
            currentStaff: null,
            login: mockLogin
        });
        mockLogin.mockResolvedValue(true); // Simulate success

        // Need to test LoginModal directly or trigger it. 
        // Testing LoginModal directly is cleaner for "Login Logic"
        const onOpenChange = vi.fn();
        const onSuccess = vi.fn();

        // Mock staff list response for the modal
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ([]) // Empty staff list forces PIN view which is simpler, OR we can just test PIN login
        });

        const { getByPlaceholderText, getByText } = render(
            <LoginModal open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />
        );

        // Enter PIN (using PIN login for simplicity as it calls `login` from context)
        const pinInput = getByPlaceholderText('4-digit PIN');
        fireEvent.change(pinInput, { target: { value: '1234' } });

        const submitBtn = getByText('Login with PIN');
        fireEvent.click(submitBtn);

        // Assert
        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('1234');
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onSuccess).toHaveBeenCalled();
    });

});

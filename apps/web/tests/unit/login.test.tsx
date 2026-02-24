// @vitest-environment jsdom
/**
 * Login Page Component Tests
 *
 * Tests form rendering, submit behaviour, error display, and post-login
 * side-effects (localStorage, router.push). fetch is mocked globally.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../app/login/page';
import { mockAuthSuccessResponse, mockAuthErrorResponse } from '../fixtures/test-data';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function okResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(body: unknown, status = 401) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render the email and password inputs', () => {
      render(<Login />);
      expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });

    it('should render the Sign in button', () => {
      render(<Login />);
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should not show an error message on initial render', () => {
      render(<Login />);
      expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
    });
  });

  describe('successful login', () => {
    it('should store the JWT token in localStorage', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Login />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe(mockAuthSuccessResponse.token);
      });
    });

    it('should store the user object in localStorage', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Login />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('user') || 'null');
        expect(stored?.email).toBe('alice@example.com');
      });
    });

    it('should redirect to / after successful login', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Login />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    });

    it('should POST credentials to /login', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Login />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/login');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.email).toBe('alice@example.com');
    });
  });

  describe('failed login', () => {
    it('should display the error message from the server', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(mockAuthErrorResponse));
      render(<Login />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'wrongpassword');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });
    });

    it('should not redirect on failed login', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(mockAuthErrorResponse));
      render(<Login />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'wrong');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument());
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show a generic error message when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      render(<Login />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Network failure')).toBeInTheDocument();
      });
    });
  });
});

// @vitest-environment jsdom
/**
 * Register Page Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Register from '../../app/register/page';
import {
  mockAuthSuccessResponse,
  mockUserAlreadyExistsResponse,
} from '../fixtures/test-data';

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

function errorResponse(body: unknown, status = 409) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('should render email, password and name inputs', () => {
      render(<Register />);
      expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Name (Optional)')).toBeInTheDocument();
    });

    it('should render the Sign up button', () => {
      render(<Register />);
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should not show an error on initial render', () => {
      render(<Register />);
      expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });
  });

  describe('successful registration', () => {
    it('should store the JWT token in localStorage', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Register />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe(mockAuthSuccessResponse.token);
      });
    });

    it('should redirect to / after successful registration', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Register />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    });

    it('should POST to /register with email, password and name', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Register />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.type(screen.getByPlaceholderText('Name (Optional)'), 'Alice');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/register');
      const body = JSON.parse(opts.body);
      expect(body.email).toBe('alice@example.com');
      expect(body.name).toBe('Alice');
    });

    it('should work without a name (name is optional)', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mockAuthSuccessResponse));
      render(<Register />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'bob@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    });
  });

  describe('failed registration', () => {
    it('should display the error message when user already exists', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(mockUserAlreadyExistsResponse, 409));
      render(<Register />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByText('User already exists')).toBeInTheDocument();
      });
    });

    it('should not redirect on failed registration', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(mockUserAlreadyExistsResponse));
      render(<Register />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => expect(screen.getByText('User already exists')).toBeInTheDocument());
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show error message when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      render(<Register />);

      await userEvent.type(screen.getByPlaceholderText('Email address'), 'alice@example.com');
      await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByText('Network failure')).toBeInTheDocument();
      });
    });
  });
});

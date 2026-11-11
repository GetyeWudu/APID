import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { useAuth } from '../../../app/AuthContext';
import type { ApiErrorPayload } from '../../../shared/api/apiClient';

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && user) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : '/'} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const profile = await login({ username: username.trim(), password });
      if (profile.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(state?.from || '/', { replace: true });
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiErrorPayload>;
      setError(axiosErr.response?.data?.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="apid-auth-wrapper">
      <div className="apid-card apid-auth-card">
        <h1>Sign in to APID</h1>
        <p className="apid-subtitle">
          Abyssinia Personal Intelligence &amp; Development Portal
        </p>

        {state?.notice && <div className="apid-alert apid-alert-ok">{state.notice}</div>}
        {error && <div className="apid-alert apid-alert-err">{error}</div>}

        <form onSubmit={handleSubmit} className="apid-form">
          <div className="apid-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="apid-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="apid-btn apid-btn-primary" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}


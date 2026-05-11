import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Beaker } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        'Ошибка при входе. Проверьте данные и попробуйте снова.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-page"
    >
      <div
        className="w-full max-w-md"
        style={{
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '40px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 64px rgba(131,110,254,0.12)',
          padding: '48px 40px',
        }}
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)',
            }}
          >
            <Beaker className="h-8 w-8 text-white" />
          </div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{
              background: 'linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            XimOS
          </h1>
          <p className="text-sm text-brand-text-secondary">
            Операционная система управления бизнесом
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5 text-brand-text"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm rounded-2xl transition-all outline-none"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-card)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#836efe';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(131,110,254,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5 text-brand-text"
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm rounded-2xl transition-all outline-none"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-card)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#836efe';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(131,110,254,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-2xl text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#dc2626',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-6 text-white text-sm font-semibold rounded-brand transition-opacity"
            style={{
              background: 'linear-gradient(135deg, rgba(141,103,255,1) 0%, rgba(200,86,255,1) 100%)',
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                />
                Вход...
              </span>
            ) : (
              'Войти'
            )}
          </button>

          <p className="text-center text-sm text-brand-text-secondary mt-5">
            Нет аккаунта?{' '}
            <Link to="/register" className="font-medium text-primary-500 hover:text-primary-600">
              Зарегистрироваться
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

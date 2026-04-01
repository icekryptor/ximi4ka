import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Beaker } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Заполните все поля');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        'Ошибка при регистрации. Попробуйте снова.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const inputStyle = {
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-bg-card)',
  };

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#836efe';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(131,110,254,0.15)';
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--color-border)';
    e.currentTarget.style.boxShadow = 'none';
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-page">
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
        <div className="text-center mb-8">
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
            Регистрация
          </h1>
          <p className="text-sm text-brand-text-secondary">
            Создайте аккаунт в системе Ximi4ka
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium mb-1.5 text-brand-text">
              Имя
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Иванов"
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm rounded-2xl transition-all outline-none"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-brand-text">
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
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-brand-text">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов"
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm rounded-2xl transition-all outline-none"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div className="mb-5">
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5 text-brand-text">
              Подтверждение пароля
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm rounded-2xl transition-all outline-none"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Регистрация...
              </span>
            ) : (
              'Зарегистрироваться'
            )}
          </button>

          <p className="text-center text-sm text-brand-text-secondary mt-5">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="font-medium text-primary-500 hover:text-primary-600">
              Войти
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

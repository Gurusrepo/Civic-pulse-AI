import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import nammakkalLogo from '../../assets/nammakkal-logo.png';
import { getApiErrorMessage } from '../../api/errors.js';

const roleLandingRoutes = {
  CITIZEN: '/citizen',
  OFFICER: '/officer',
  ADMIN: '/admin'
};

// Shows a calm loading screen while an existing cookie session is restored.
function SessionLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6ef] px-6">
      <p role="status" className="text-sm font-medium text-[#385743]">Checking your session...</p>
    </main>
  );
}

// Provides the branded sign-in form and routes users according to their backend role.
export default function Login() {
  const { user, isAuthenticated, isLoading, sessionError, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sends authenticated visitors directly to the landing page for their role.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(roleLandingRoutes[user?.role] ?? '/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, user]);

  // Submits credentials through the shared cookie-based authentication context.
  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    if (password.length > 72 || new TextEncoder().encode(password).length > 72) {
      setErrorMessage('Your password must be no more than 72 characters and 72 bytes.');
      return;
    }
    setIsSubmitting(true);

    try {
      const authenticatedUser = await login({ email: email.trim(), password });
      navigate(roleLandingRoutes[authenticatedUser?.role] ?? '/', { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'We could not sign you in. Check your details and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Keeps the email field synchronized with the form state.
  function handleEmailChange(event) {
    setEmail(event.target.value);
  }

  // Keeps the password field synchronized with the form state.
  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }

  // Toggles password visibility for easier entry on personal devices.
  function handlePasswordVisibility() {
    setShowPassword(!showPassword);
  }

  if (isLoading) return <SessionLoading />;
  if (isAuthenticated) return <SessionLoading />;

  return (
    <main className="min-h-screen bg-[#f7f6ef] lg:grid lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#173d2b] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-28 top-1/4 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-12 top-[30%] h-64 w-64 rounded-full border border-[#d4ae58]/25" />
        <Link to="/" aria-label="NAMMAKKAL home" className="relative z-10 inline-flex w-fit rounded-2xl bg-[#fbfaf5] p-3">
          <img className="h-auto w-56" src={nammakkalLogo} alt="NAMMAKKAL" />
        </Link>
        <div className="relative z-10 max-w-lg pb-12">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#e2c77f]">A better tomorrow, together</p>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">Your town.<br />Your voice.<br /><span className="text-[#e2c77f]">Our future.</span></h1>
          <p className="mt-7 max-w-md text-base leading-7 text-white/75">Connect with your community and help make local services work better for everyone.</p>
        </div>
        <p className="relative z-10 text-xs text-white/55">A community platform for Nammakkal</p>
      </aside>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-24">
        <div className="w-full max-w-md">
          <Link to="/" aria-label="NAMMAKKAL home" className="mb-9 inline-flex rounded-xl bg-white p-2 shadow-sm lg:hidden">
            <img className="h-auto w-48" src={nammakkalLogo} alt="NAMMAKKAL" />
          </Link>
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#9a7832]">Welcome back</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#20382a] sm:text-4xl">Sign in to your account</h2>
            <p className="mt-3 text-sm leading-6 text-[#68736a]">Use your registered email address to continue.</p>
          </div>

          {sessionError && <p role="status" className="mb-5 rounded-xl border border-[#e7d9b4] bg-[#fff9e9] px-4 py-3 text-sm text-[#725a23]">We could not verify an existing session. You can still try signing in.</p>}
          {errorMessage && <p role="alert" className="mb-5 rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{errorMessage}</p>}

            <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-[#34483a]">Email address</label>
                <input id="login-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={handleEmailChange} className="w-full rounded-xl border border-[#d9ded5] bg-white px-4 py-3.5 text-sm text-[#24362a] outline-none transition placeholder:text-[#9aa39b] focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-[#34483a]">Password</label>
              <div className="relative">
                <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={72} required value={password} onChange={handlePasswordChange} className="w-full rounded-xl border border-[#d9ded5] bg-white px-4 py-3.5 pr-20 text-sm text-[#24362a] outline-none transition placeholder:text-[#9aa39b] focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" placeholder="Enter your password" />
                <button type="button" onClick={handlePasswordVisibility} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-2 z-10 grid w-10 place-items-center rounded-lg text-[#426c4d] transition hover:bg-[#edf2eb] hover:text-[#1d4933] focus:outline-none focus:ring-2 focus:ring-[#477454]/40">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    {showPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 5.2A11.7 11.7 0 0112 5c5.2 0 8.8 4.4 10 7-.4.9-1.2 2.1-2.3 3.2M6.2 6.2C3.9 7.5 2.5 9.5 2 12c.6 1.4 1.9 3.1 3.8 4.4A10.4 10.4 0 0012 19c1 0 1.9-.1 2.8-.4" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center rounded-xl bg-[#1d4933] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163b29] focus:outline-none focus:ring-4 focus:ring-[#477454]/25 disabled:cursor-not-allowed disabled:opacity-65">
              {isSubmitting ? 'Signing you in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#68736a]">New to NAMMAKKAL? <Link className="font-semibold text-[#1d4933] underline decoration-[#d4ae58] decoration-2 underline-offset-4 hover:text-[#9a7832]" to="/register">Create a citizen account</Link></p>
        </div>
      </section>
    </main>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../api/errors.js';
import nammakkalLogo from '../assets/nammakkal-logo.png';

// Provides a branded placeholder for dashboard routes that are not implemented yet.
export default function PlaceholderPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(getApiErrorMessage(error, 'You have been signed out here, but the server could not confirm logout.'));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6ef] px-6 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-[#e5e2d5] bg-white p-8 text-center shadow-[0_20px_60px_-35px_rgba(28,54,38,0.25)] sm:p-12">
        <img className="mx-auto mb-8 h-auto w-64 max-w-full" src={nammakkalLogo} alt="Nammakkal — civic services for a better tomorrow" />
        <h1 className="text-3xl font-semibold tracking-tight text-[#193b2a]">Your civic space is coming soon</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-[#68736a]">
          {user ? `Signed in as ${user.name}. This part of NAMMAKKAL is being prepared.` : 'This part of NAMMAKKAL is being prepared. Sign in to continue to your account.'}
        </p>
        {logoutError && <p role="status" className="mt-4 text-sm text-[#725a23]">{logoutError}</p>}
        {user ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {user.role === 'ADMIN' && <Link to="/admin/announcements" className="inline-flex min-h-11 items-center rounded-full border border-[#cfd8ce] px-6 py-3 text-sm font-semibold text-[#1d4933] hover:bg-[#f7faf5]">Manage announcements</Link>}
            <button type="button" onClick={handleLogout} className="inline-flex min-h-11 rounded-full bg-[#1d4933] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#153a28] focus:outline-none focus:ring-4 focus:ring-[#477454]/25">Sign out</button>
          </div>
        ) : (
          <Link className="mt-8 inline-flex min-h-11 rounded-full bg-[#1d4933] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#153a28] focus:outline-none focus:ring-4 focus:ring-[#477454]/25" to="/login">Continue to sign in</Link>
        )}
      </section>
    </main>
  );
}

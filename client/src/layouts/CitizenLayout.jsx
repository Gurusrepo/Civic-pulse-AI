import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage } from '../api/errors.js';
import nammakkalLogo from '../assets/nammakkal-whiteColor-logo.png';

const navClass = ({ isActive }) => `inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition ${isActive ? 'border-[#d4ae58] text-white' : 'border-transparent text-white/75 hover:text-white'}`;

export default function CitizenLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setLogoutError('');
    setIsSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(getApiErrorMessage(error, 'You have been signed out here, but the server could not confirm logout.'));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f6ef]">
      <header className="bg-[#173d2b] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/citizen" className="inline-flex rounded-lg px-2 py-1 transition-transform duration-200 ease-out hover:scale-[1.03] hover:bg-transparent active:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <img src={nammakkalLogo} alt="NAMMAKKAL civic platform" className="h-8 w-auto max-w-36 object-contain sm:h-10 sm:max-w-44" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-white/80 sm:inline font-serif" title={user?.name}>{user?.name}</span>
            <button type="button" onClick={handleLogout} disabled={isSigningOut} className="min-h-10 rounded-lg border border-white/25 px-3 text-sm font-semibold transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#e2c77f] disabled:opacity-60">{isSigningOut ? 'Signing out...' : 'Sign out'}</button>
          </div>
          <nav aria-label="Citizen navigation" className="order-3 flex w-full gap-1 overflow-x-auto border-t border-white/15 sm:order-none sm:w-auto sm:border-0">
            <NavLink to="/citizen" end className={navClass}>Overview</NavLink>
            <NavLink to="/citizen/complaints" end className={navClass}>My complaints</NavLink>
            <NavLink to="/citizen/complaints/new" className={navClass}>Report an issue</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        {logoutError && <p role="status" className="mb-5 rounded-xl border border-[#e7d9b4] bg-[#fff9e9] px-4 py-3 text-sm text-[#725a23]">{logoutError}</p>}
        <Outlet />
      </main>
    </div>
  );
}

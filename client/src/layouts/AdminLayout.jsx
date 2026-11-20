import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ClipboardList, CopyCheck, Flag, LayoutDashboard, Lightbulb, LogOut,
  MapPinned, Megaphone, Menu, Scale, Settings, Users, UsersRound, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDismissableLayer } from '../context/DismissableLayerContext.jsx';
import { getApiErrorMessage } from '../api/errors.js';
import { useTranslation } from '../i18n/LocaleProvider.jsx';
import nammakkalLogo from '../assets/nammakkal-logo.png';

export const adminNavigationItems = [
  { key: 'overview', path: '', icon: LayoutDashboard, available: true },
  { key: 'complaints', path: 'complaints', icon: ClipboardList, available: true },
  { key: 'reportedProblems', path: 'reported-problems', icon: Flag, available: true },
  { key: 'suggestions', path: 'suggestions', icon: Lightbulb },
  { key: 'announcements', path: 'announcements', icon: Megaphone, available: true },
  { key: 'officers', path: 'officers', icon: Users, available: true },
  { key: 'wards', path: 'wards', icon: MapPinned, available: true },
  { key: 'teams', path: 'teams', icon: UsersRound, available: true },
  { key: 'duplicateReviews', path: 'duplicate-reviews', icon: CopyCheck, available: true },
  { key: 'resolutionDisputes', path: 'disputes', icon: Scale, available: true },
  { key: 'notifications', path: 'notifications', icon: Bell },
  { key: 'settings', path: 'settings', icon: Settings }
];

function NavigationLinks({ onNavigate, isMobile, t }) {
  const linkClass = ({ isActive }) => [
    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f]',
    isActive
      ? 'bg-white/15 text-white'
      : 'text-white/75 hover:bg-white/10 hover:text-white'
  ].join(' ');

  return (
    <nav
      aria-label={t(isMobile ? 'admin.layout.mobileNavigation' : 'admin.layout.navigation')}
      className="flex flex-col gap-1"
    >
      {adminNavigationItems.map(({ key, path, icon: Icon, available }) => (
        <NavLink
          key={key}
          to={path ? `/admin/${path}` : '/admin'}
          end={key === 'overview'}
          onClick={onNavigate}
          className={linkClass}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{t(`admin.navigation.${key}`)}</span>
          {!available && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/65">
              {t('admin.layout.comingSoon')}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContents({ user, logout, onNavigate, isMobile, t }) {
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(getApiErrorMessage(error, t('admin.layout.logoutError')));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link
        to="/admin"
        onClick={onNavigate}
        className="inline-flex w-fit rounded-lg px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <img
          src={nammakkalLogo}
          alt={t('admin.layout.logoAlt')}
          className="h-9 w-auto max-w-44 object-contain"
        />
      </Link>

      <div className="mt-7 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
        <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
        <p className="mt-1 text-xs text-white/65">{t('admin.layout.administrator')}</p>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <NavigationLinks onNavigate={onNavigate} isMobile={isMobile} t={t} />
      </div>

      <div className="mt-4 border-t border-white/15 pt-4">
        {logoutError && (
          <p role="alert" className="mb-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-[#f4d88e]">
            {logoutError}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f]"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          {t('admin.layout.signOut')}
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const {
    isOpen: isMobileNavigationOpen,
    triggerRef,
    panelRef,
    toggle,
    close
  } = useDismissableLayer('admin-mobile-navigation');

  useEffect(() => {
    close();
  }, [close, location.pathname]);

  return (
    <div className="min-h-screen bg-[#f7f6ef] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto bg-[#173d2b] px-5 py-7 text-white lg:flex">
        <SidebarContents
          user={user}
          logout={logout}
          onNavigate={close}
          isMobile={false}
          t={t}
        />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 bg-[#173d2b] px-4 text-white shadow-sm sm:px-6 lg:hidden">
          <Link to="/admin" className="inline-flex min-w-0 items-center gap-3">
            <img
              src={nammakkalLogo}
              alt={t('admin.layout.logoAlt')}
              className="h-8 w-auto max-w-36 object-contain"
            />
            <span className="truncate text-sm font-semibold">{t('admin.layout.title')}</span>
          </Link>
          <button
            ref={triggerRef}
            type="button"
            onClick={toggle}
            aria-label={t(isMobileNavigationOpen ? 'admin.layout.closeMenu' : 'admin.layout.openMenu')}
            aria-expanded={isMobileNavigationOpen}
            aria-controls="admin-mobile-navigation"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f]"
          >
            {isMobileNavigationOpen
              ? <X className="h-5 w-5" aria-hidden="true" />
              : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>

      {isMobileNavigationOpen && (
        <div
          ref={panelRef}
          id="admin-mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.layout.mobileNavigation')}
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('admin.layout.closeMenu')}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/45"
          />
          <aside className="relative z-10 h-full w-[min(21rem,86vw)] overflow-y-auto bg-[#173d2b] px-5 py-6 text-white shadow-2xl">
            <SidebarContents
              user={user}
              logout={logout}
              onNavigate={close}
              isMobile
              t={t}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

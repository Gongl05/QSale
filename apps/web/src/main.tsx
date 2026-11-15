import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  NavLink,
  Link,
} from 'react-router-dom';
import { Bell, CalendarDays, ChevronRight, LogOut, Menu, Shield, UserRound, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import '@fontsource-variable/manrope';
import './styles.css';
import { api, queryClient, SessionProvider, useSession } from './session';
import { ErrorBoundary, ErrorState, Loading, ToastProvider, useToast } from './ui';
import { useOnline } from './hooks';

function Protected() {
  const { user, loading, error, retry } = useSession();
  const location = useLocation();
  if (loading) return <Loading label="Preparando tu cuenta…" />;
  if (error)
    return (
      <main className="standalone">
        <ErrorState error={error} retry={retry} />
      </main>
    );
  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to={'/login?returnTo=' + encodeURIComponent(location.pathname + location.search)}
      replace
    />
  );
}
function AppShell() {
  const { user, signOut } = useSession();
  const toast = useToast();
  const online = useOnline();
  const location = useLocation();
  const [menu, setMenu] = React.useState(false);
  const [mobile, setMobile] = React.useState(() => window.matchMedia('(max-width: 760px)').matches);
  const sidebar = React.useRef<HTMLElement>(null);
  const menuTrigger = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setMenu(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  React.useEffect(() => {
    if (!mobile || !menu) return;
    const nodes = () =>
      Array.from(
        sidebar.current!.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'),
      ).filter((item) => item.getClientRects().length > 0);
    nodes()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === 'Tab') {
        const all = nodes(),
          first = all[0],
          last = all.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = overflow;
      requestAnimationFrame(() => menuTrigger.current?.focus());
    };
  }, [mobile, menu]);
  const notices = useQuery({
    queryKey: ['notifications', 'badge'],
    queryFn: ({ signal }) => api.notifications({ page: 0, size: 10 }, signal),
  });
  React.useEffect(() => setMenu(false), [location.pathname]);
  const breadcrumb = location.pathname.startsWith('/plans/')
    ? location.pathname.endsWith('/new')
      ? 'Crear plan'
      : location.pathname.endsWith('/edit')
        ? 'Editar plan'
        : 'Detalle del plan'
    : null;
  return (
    <div className="app">
      <a className="skip-link" href="#content" inert={mobile && menu}>
        Saltar al contenido
      </a>
      <aside
        ref={sidebar}
        inert={mobile && !menu}
        role={mobile && menu ? 'dialog' : undefined}
        aria-modal={mobile && menu ? true : undefined}
        aria-label="Menú principal"
        className={'sidebar ' + (menu ? 'is-open' : '')}
      >
        {mobile && (
          <button
            className="icon-button drawer-close"
            aria-label="Cerrar menú"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        )}
        <Link className="brand" to="/plans" aria-label="QSale, mis planes">
          <img src="/qsale.png" alt="" />
          <span>
            QSale<span className="brand-dot">.</span>
          </span>
        </Link>
        <p className="brand-caption">
          Menos vueltas.
          <br />
          Más planes juntos.
        </p>
        <nav aria-label="Navegación principal">
          <NavLink to="/plans">
            <CalendarDays size={20} />
            Mis planes
          </NavLink>
          <NavLink to="/notifications">
            <Bell size={20} />
            Notificaciones
            {Boolean(notices.data?.unreadCount) && (
              <span className="count">{notices.data!.unreadCount}</span>
            )}
          </NavLink>
          <NavLink to="/profile">
            <UserRound size={20} />
            Mi perfil
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin">
              <Shield size={20} />
              Administración
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user?.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar sesión"
            onClick={() => void signOut().catch((error) => toast(error.message, true))}
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          tabIndex={-1}
          className="menu-scrim"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-area" inert={mobile && menu}>
        <div className="topbar">
          <button
            ref={menuTrigger}
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Abrir menú"
            aria-expanded={menu}
          >
            <Menu />
          </button>
          <nav aria-label="Ruta de navegación">
            <Link to="/plans">QSale</Link>
            <ChevronRight size={14} />
            {breadcrumb ? (
              <>
                <Link to="/plans">Mis planes</Link>
                <ChevronRight size={14} />
                <span>{breadcrumb}</span>
              </>
            ) : (
              <span>
                {{
                  '/plans': 'Mis planes',
                  '/notifications': 'Notificaciones',
                  '/profile': 'Mi perfil',
                  '/admin': 'Administración',
                }[location.pathname] ?? 'QSale'}
              </span>
            )}
          </nav>
          <Link
            className="icon-button"
            to="/notifications"
            aria-label={`Notificaciones${notices.data?.unreadCount ? ': ' + notices.data.unreadCount + ' sin leer' : ''}`}
          >
            <Bell size={21} />
            {Boolean(notices.data?.unreadCount) && <span className="notification-dot" />}
          </Link>
        </div>
        {!online && (
          <div role="status" className="offline-banner">
            Estás sin conexión. Puedes ver lo cargado; vuelve a conectarte para guardar cambios.
          </div>
        )}
        <main id="content" tabIndex={-1}>
          <React.Suspense fallback={<Loading />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
const lazyPage = (module: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await module()).default,
});
const router = createBrowserRouter([
  { path: '/login', lazy: lazyPage(() => import('./pages/Auth')) },
  { path: '/register', lazy: lazyPage(() => import('./pages/Auth')) },
  {
    element: <Protected />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/plans', lazy: lazyPage(() => import('./pages/Plans')) },
          { path: '/plans/new', lazy: lazyPage(() => import('./pages/PlanForm')) },
          { path: '/plans/:id', lazy: lazyPage(() => import('./pages/PlanDetail')) },
          { path: '/plans/:id/edit', lazy: lazyPage(() => import('./pages/PlanForm')) },
          { path: '/join/:code?', lazy: lazyPage(() => import('./pages/Join')) },
          { path: '/notifications', lazy: lazyPage(() => import('./pages/Notifications')) },
          { path: '/profile', lazy: lazyPage(() => import('./pages/Profile')) },
          { path: '/admin', lazy: lazyPage(() => import('./pages/Admin')) },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/plans" replace /> },
  { path: '*', lazy: lazyPage(() => import('./pages/NotFound')) },
]);
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

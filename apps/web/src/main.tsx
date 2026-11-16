import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  NavLink,
  Link,
} from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  LogOut,
  Menu,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import "@fontsource-variable/manrope";
import "./styles.css";
import { api, queryClient, SessionProvider, useSession } from "./session";
import {
  Button,
  ErrorBoundary,
  ErrorState,
  Loading,
  ToastProvider,
  useToast,
} from "./ui";
import { useOnline } from "./hooks";
import { UnsavedChangesNavigationGuard } from "./useUnsavedChanges";

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
      to={
        "/login?returnTo=" +
        encodeURIComponent(location.pathname + location.search)
      }
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
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuMotion, setMenuMotion] = React.useState(false);
  const [mobile, setMobile] = React.useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const sidebar = React.useRef<HTMLElement>(null);
  const menuTrigger = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) {
        setMenu(false);
        setMenuVisible(false);
      }
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  React.useEffect(() => {
    if (menu) {
      setMenuVisible(true);
      return;
    }
    if (!menuMotion) {
      setMenuVisible(false);
      return;
    }
    const timer = setTimeout(() => setMenuVisible(false), 200);
    return () => clearTimeout(timer);
  }, [menu, menuMotion]);
  React.useEffect(() => {
    const content = document.getElementById("content");
    const updateTitle = () => {
      const heading = content?.querySelector("h1")?.textContent?.trim();
      document.title = heading ? `${heading} · Quesale` : "Quesale";
    };
    updateTitle();
    const observer = new MutationObserver(updateTitle);
    if (content)
      observer.observe(content, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    return () => observer.disconnect();
  }, [location.pathname]);
  React.useEffect(() => {
    if (!mobile || !menu) return;
    const nodes = () =>
      Array.from(
        sidebar.current!.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ),
      ).filter((item) => item.getClientRects().length > 0);
    nodes()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuMotion(false);
        setMenuVisible(false);
        setMenu(false);
      }
      if (event.key === "Tab") {
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
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = overflow;
      requestAnimationFrame(() => menuTrigger.current?.focus());
    };
  }, [mobile, menu]);
  const notices = useQuery({
    queryKey: ["notifications", "badge"],
    queryFn: ({ signal }) => api.notifications({ page: 0, size: 10 }, signal),
  });
  React.useEffect(() => {
    setMenuMotion(false);
    setMenuVisible(false);
    setMenu(false);
  }, [location.pathname]);
  const breadcrumb = location.pathname.startsWith("/plans/")
    ? location.pathname.endsWith("/new")
      ? "Crear plan"
      : location.pathname.endsWith("/edit")
        ? "Editar plan"
        : "Detalle del plan"
    : null;
  return (
    <div className="app">
      <a className="skip-link" href="#content" inert={mobile && menu}>
        Saltar al contenido
      </a>
      <aside
        ref={sidebar}
        inert={mobile && !menu}
        role={mobile && menu ? "dialog" : undefined}
        aria-modal={mobile && menu ? true : undefined}
        aria-label="Menú principal"
        className={"sidebar " + (menu ? "is-open" : "")}
        data-motion={menuMotion}
      >
        {mobile && (
          <button
            className="icon-button drawer-close"
            aria-label="Cerrar menú"
            onClick={(event) => {
              setMenuMotion(event.detail > 0);
              setMenu(false);
            }}
          >
            <X size={20} />
          </button>
        )}
        <Link className="brand" to="/plans" aria-label="Quesale, mis planes">
          <img src="/qsale.png" alt="" />
          <span>Quesale</span>
        </Link>
        <p className="brand-caption">Encuéntrense aquí</p>
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
          {user?.role === "ADMIN" && (
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
            onClick={() =>
              void signOut().catch((error) => toast(error.message, true))
            }
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>
      {menuVisible && mobile && (
        <button
          tabIndex={-1}
          className="menu-scrim"
          data-open={menu}
          aria-label="Cerrar menú"
          onClick={() => {
            setMenuMotion(true);
            setMenu(false);
          }}
        />
      )}
      <div className="main-area" inert={mobile && menu}>
        <div className="topbar">
          <button
            ref={menuTrigger}
            className="icon-button mobile-menu"
            onClick={(event) => {
              setMenuMotion(
                event.detail > 0 &&
                  !window.matchMedia("(prefers-reduced-motion: reduce)")
                    .matches,
              );
              setMenuVisible(true);
              setMenu(!menu);
            }}
            aria-label="Abrir menú"
            aria-expanded={menu}
          >
            <Menu />
          </button>
          <nav aria-label="Ruta de navegación">
            <Link to="/plans">Quesale</Link>
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
                  "/plans": "Mis planes",
                  "/notifications": "Notificaciones",
                  "/profile": "Mi perfil",
                  "/admin": "Administración",
                }[location.pathname] ?? "Quesale"}
              </span>
            )}
          </nav>
          <Link
            className="icon-button"
            to="/notifications"
            aria-label={`Notificaciones${notices.data?.unreadCount ? ": " + notices.data.unreadCount + " sin leer" : ""}`}
          >
            <Bell size={21} />
            {Boolean(notices.data?.unreadCount) && (
              <span className="notification-dot" />
            )}
          </Link>
        </div>
        {!online && (
          <div role="status" className="offline-banner">
            Estás sin conexión. Puedes ver lo cargado; vuelve a conectarte para
            guardar cambios.
          </div>
        )}
        <main id="content" tabIndex={-1}>
          <UnsavedChangesNavigationGuard />
          <React.Suspense fallback={<Loading />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
const lazyPage =
  (module: () => Promise<{ default: React.ComponentType }>) => async () => ({
    Component: (await module()).default,
  });
function RouteFailure() {
  return (
    <main className="standalone">
      <h1>No pudimos abrir esta pantalla</h1>
      <p>
        Revisa tu conexión y vuelve a cargar. Tus datos guardados siguen en tu
        cuenta.
      </p>
      <Button onClick={() => location.reload()}>Volver a cargar</Button>
      <a href="/plans">Ir a mis planes</a>
    </main>
  );
}
const router = createBrowserRouter([
  {
    errorElement: <RouteFailure />,
    hydrateFallbackElement: <Loading label="Abriendo Quesale…" />,
    children: [
      { path: "/login", lazy: lazyPage(() => import("./pages/Auth")) },
      { path: "/register", lazy: lazyPage(() => import("./pages/Auth")) },
      {
        path: "/forgot-password",
        lazy: lazyPage(() => import("./pages/PasswordRecovery")),
      },
      {
        path: "/reset-password",
        lazy: lazyPage(() => import("./pages/PasswordRecovery")),
      },
      {
        element: <Protected />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/plans", lazy: lazyPage(() => import("./pages/Plans")) },
              {
                path: "/plans/new",
                lazy: lazyPage(() => import("./pages/PlanForm")),
              },
              {
                path: "/plans/:id",
                lazy: lazyPage(() => import("./pages/PlanDetail")),
              },
              {
                path: "/plans/:id/edit",
                lazy: lazyPage(() => import("./pages/PlanForm")),
              },
              {
                path: "/join/:code?",
                lazy: lazyPage(() => import("./pages/Join")),
              },
              {
                path: "/notifications",
                lazy: lazyPage(() => import("./pages/Notifications")),
              },
              {
                path: "/profile",
                lazy: lazyPage(() => import("./pages/Profile")),
              },
              { path: "/admin", lazy: lazyPage(() => import("./pages/Admin")) },
            ],
          },
        ],
      },
      { path: "/", element: <Navigate to="/plans" replace /> },
      { path: "*", lazy: lazyPage(() => import("./pages/NotFound")) },
    ],
  },
]);
createRoot(document.getElementById("root")!).render(
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

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Planes en grupo con Quesale">
        <Link to="/" className="brand" aria-label="Quesale, inicio">
          <img src="/qsale.png" alt="" />
          <span>Quesale</span>
        </Link>
        <div className="auth-story-main">
          <h2>
            De acuerdo.
            <br />
            <span>Nos vemos.</span>
          </h2>
          <p>
            La fecha, el lugar y las respuestas de tu grupo, en un mismo plan.
          </p>
          <ul className="auth-process">
            <li>
              <CalendarDays size={20} strokeWidth={1.5} aria-hidden="true" />{" "}
              Propongan una fecha
            </li>
            <li>
              <MapPin size={20} strokeWidth={1.5} aria-hidden="true" /> Elijan
              dónde encontrarse
            </li>
            <li>
              <UsersRound size={20} strokeWidth={1.5} aria-hidden="true" />{" "}
              Confirmen quién va
            </li>
          </ul>
        </div>
        <p className="auth-story-footer">Cada plan, un punto de encuentro</p>
      </section>
      <section className="auth-form">{children}</section>
    </main>
  );
}

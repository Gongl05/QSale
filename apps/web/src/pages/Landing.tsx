import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Clock3, MapPin, RotateCcw, UsersRound } from 'lucide-react';
import { useSession } from '../session';
import '../landing.css';

/** The group chat everybody knows: lots of messages, no plan. */
const chat = [
  { who: 'Cami', text: 'Oe, ¿y la salida que dijimos? 👀', side: 'left' },
  { who: 'Diego', text: 'Yo puedo el sábado… o el domingo', side: 'right' },
  { who: 'Lau', text: '¿Pero dónde? Yo vivo en Surco 😩', side: 'left' },
  { who: 'Pipe', text: 'Cualquier cosa me avisan', side: 'right' },
  { who: 'Cami', text: '¿Entonces?', side: 'left' },
] as const;

const steps = [
  {
    title: 'Propón el plan',
    text: 'Ponle nombre, un presupuesto y cuántas personas hacen falta para que salga.',
  },
  {
    title: 'Invita a tu grupo',
    text: 'Comparte un enlace, un código o un QR. Cada quien se une desde su celular.',
  },
  {
    title: 'Decidan juntos',
    text: 'Marquen qué días pueden y voten fechas y lugares. QSale les muestra lo que más conviene.',
  },
  {
    title: 'Confirmen y salgan',
    text: 'Cuando se completa el mínimo, el plan se cierra con la fecha y el lugar elegidos.',
  },
];

const occasions = [
  'La pichanga del sábado.',
  'El cumple sorpresa de Cami.',
  'El almuerzo de la oficina.',
  'El viaje de promo.',
  'El grupo de estudio para el parcial.',
  'Ese concierto que nadie quiere perderse.',
];

function ChatToPlan() {
  // Changing the key restarts the CSS sequence when the person asks to see it again.
  const [run, setRun] = useState(0);
  return (
    <div className="lp-demo" key={run}>
      <div className="lp-chat" aria-label="Así suele verse el chat del grupo">
        <p className="lp-chat-title">
          <UsersRound size={16} aria-hidden /> Promo 2024 🎓
        </p>
        {chat.map((message, index) => (
          <p
            key={index}
            className={'lp-bubble ' + message.side}
            style={{ animationDelay: `${0.35 + index * 0.55}s` }}
          >
            <span className="lp-bubble-who">{message.who}</span>
            {message.text}
          </p>
        ))}
        <p className="lp-chat-silence">3 días después, nadie respondió.</p>
      </div>
      <article className="lp-plan" aria-label="El mismo plan, coordinado en QSale">
        <div className="lp-plan-head">
          <span className="lp-plan-type">Comida</span>
          <span className="lp-plan-status">¡Sale!</span>
        </div>
        <h3>Almuerzo de reencuentro</h3>
        <ul>
          <li>
            <CalendarCheck size={17} aria-hidden /> Sábado 21 de noviembre, 1:00 p. m.
          </li>
          <li>
            <MapPin size={17} aria-hidden /> La Lucha, Barranco
          </li>
          <li>
            <Clock3 size={17} aria-hidden /> 22 minutos en promedio para llegar
          </li>
        </ul>
        <div className="lp-plan-people">
          <span className="lp-faces" aria-hidden>
            {['C', 'D', 'L', 'P', 'M'].map((letter) => (
              <span key={letter}>{letter}</span>
            ))}
          </span>
          5 confirmados de un mínimo de 4
        </div>
        <div className="lp-meter" aria-hidden>
          <span />
        </div>
      </article>
      <button type="button" className="lp-replay" onClick={() => setRun(run + 1)}>
        <RotateCcw size={15} aria-hidden /> Ver de nuevo
      </button>
    </div>
  );
}

export default function Landing() {
  const { user } = useSession();
  const primary = user ? { to: '/plans', label: 'Ir a mis planes' } : { to: '/register', label: 'Crear mi cuenta gratis' };
  return (
    <div className="landing">
      <a className="skip-link" href="#lp-main">
        Saltar al contenido
      </a>
      <header className="lp-nav">
        <Link to="/" className="lp-logo" aria-label="QSale, inicio">
          <img src="/qsale.png" alt="" width="40" height="40" />
          <span>QSale.</span>
        </Link>
        <nav aria-label="Secciones">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#por-que">Por qué QSale</a>
        </nav>
        <div className="lp-nav-actions">
          {!user && (
            <Link className="lp-link" to="/login">
              Entrar
            </Link>
          )}
          <Link className="lp-button small" to={primary.to}>
            {user ? 'Mis planes' : 'Crear cuenta'}
          </Link>
        </div>
      </header>

      <main id="lp-main">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <h1>
              Ese «hay que hacer algo» sí va a salir.
            </h1>
            <p className="lp-lead">
              QSale ayuda a tu grupo a pasar del chat infinito a un plan con fecha, lugar y gente
              confirmada. Proponen, votan y listo: se sabe si sale o no.
            </p>
            <div className="lp-actions">
              <Link className="lp-button" to={primary.to}>
                {primary.label}
              </Link>
              {!user && (
                <Link className="lp-button ghost" to="/login">
                  Ya tengo cuenta
                </Link>
              )}
            </div>
            <p className="lp-note">Gratis. Solo necesitas tu correo.</p>
          </div>
          <ChatToPlan />
        </section>

        <section className="lp-steps" id="como-funciona" aria-labelledby="steps-title">
          <h2 id="steps-title">De la idea a la salida, en cuatro pasos</h2>
          <ol>
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="lp-step-number" aria-hidden>
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-features" id="por-que" aria-labelledby="features-title">
          <h2 id="features-title">Lo que QSale hace por tu grupo</h2>

          <div className="lp-feature">
            <div className="lp-feature-copy">
              <h3>Un lugar justo para todos</h3>
              <p>
                QSale calcula cuánto tarda cada persona en llegar a cada propuesta y les muestra el
                punto medio del grupo. Se acabó el «siempre vamos cerca de tu casa».
              </p>
            </div>
            <div className="lp-mock lp-mock-places" aria-hidden>
              <div className="lp-mini-map">
                <span className="pin a" />
                <span className="pin b" />
                <span className="pin c" />
                <span className="pin mid" />
              </div>
              <p>
                <strong>La Lucha, Barranco</strong>
                <span>22 min en promedio</span>
              </p>
              <p>
                <strong>Larcomar, Miraflores</strong>
                <span>31 min en promedio</span>
              </p>
            </div>
          </div>

          <div className="lp-feature reverse">
            <div className="lp-feature-copy">
              <h3>Los días en que sí pueden</h3>
              <p>
                Cada quien marca qué días tiene libres y QSale encuentra en cuáles coinciden más
                personas. Nadie tiene que hacer la tabla en Excel.
              </p>
            </div>
            <div className="lp-mock lp-mock-days" aria-hidden>
              {[
                ['Jue', 2],
                ['Vie', 3],
                ['Sáb', 5],
                ['Dom', 4],
              ].map(([day, count]) => (
                <div key={day} className={count === 5 ? 'best' : ''}>
                  <span className="bar" style={{ height: `${Number(count) * 18}px` }} />
                  <strong>{day}</strong>
                  <span>{count} pueden</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-feature">
            <div className="lp-feature-copy">
              <h3>Sabes si sale antes de reservar</h3>
              <p>
                El semáforo de viabilidad te dice si ya están la gente, la fecha y el lugar. Y si
                alguien no puede a última hora, el grupo vota una reprogramación sin empezar de cero.
              </p>
            </div>
            <div className="lp-mock lp-mock-light" aria-hidden>
              <p className="off">
                <span /> Falta gente
              </p>
              <p className="maybe">
                <span /> Por definir fecha o lugar
              </p>
              <p className="go">
                <span /> Listo para cerrar
              </p>
            </div>
          </div>
        </section>

        <section className="lp-occasions" aria-labelledby="occasions-title">
          <h2 id="occasions-title">Para cualquier plan que tu grupo tenga pendiente</h2>
          <p>
            {occasions.map((item) => (
              <span key={item}>{item} </span>
            ))}
          </p>
        </section>

        <section className="lp-final" aria-labelledby="final-title">
          <img src="/qsale.png" alt="" width="88" height="88" />
          <h2 id="final-title">Tu grupo ya tiene la idea. Ponle fecha.</h2>
          <p>Crea tu cuenta, propón el plan y comparte el enlace. Lo demás lo deciden juntos.</p>
          <div className="lp-actions">
            <Link className="lp-button" to={primary.to}>
              {primary.label}
            </Link>
            {!user && (
              <Link className="lp-button ghost light" to="/login">
                Ya tengo cuenta
              </Link>
            )}
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <p>
          <img src="/qsale.png" alt="" width="22" height="22" /> QSale, hecho en Lima.
        </p>
        <p>Proyecto del curso CS 2031 Desarrollo Basado en Plataforma.</p>
      </footer>
    </div>
  );
}

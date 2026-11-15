import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Check, Eye, EyeOff } from 'lucide-react';
import { safeReturnPath, signInSchema, signUpSchema, type SignUpInput } from '@qsale/contracts';
import { useSession } from '../session';
import { Button, Field, Loading } from '../ui';

export default function Auth() {
  const registering = useLocation().pathname === '/register';
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useSession();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const returnTo = safeReturnPath(params.get('returnTo'));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(registering ? signUpSchema : signInSchema) as never,
  });
  if (loading) return <Loading label="Preparando QSale…" />;
  if (user) return <Navigate to={returnTo} replace />;
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link to="/" className="brand">
          <img src="/qsale.png" alt="" />
          <span>QSale.</span>
        </Link>
        <div>
          <h1>
            Ese “hay que
            <br />
            hacer algo”
            <br />
            <span>sí va a salir.</span>
          </h1>
          <p>
            Un lugar para ponerse de acuerdo.
            <br />
            Una fecha, un sitio y todo tu grupo.
          </p>
          <ul>
            <li>
              <Check size={19} />
              Propongan fecha y lugar
            </li>
            <li>
              <Check size={19} />
              Voten sin perderse en el chat
            </li>
            <li>
              <Check size={19} />
              Confirmen y hagan que pase
            </li>
          </ul>
        </div>
        <span className="story-signoff">
          El siguiente buen recuerdo empieza aquí.
          <ArrowUpRight size={24} />
        </span>
      </section>
      <section className="auth-form">
        <div>
          <h2>{registering ? 'Hazle espacio al próximo plan' : 'Qué bueno verte por aquí'}</h2>
          <p>
            {registering
              ? 'Crea tu cuenta y reúne a tu gente.'
              : 'Entra y descubre qué está tomando forma.'}
          </p>
          <form
            noValidate
            onSubmit={handleSubmit(async (values) => {
              setError('');
              try {
                await (registering ? signUp(values) : signIn(values));
                navigate(returnTo, { replace: true });
              } catch (error) {
                setError((error as Error).message);
              }
            })}
          >
            {registering && (
              <Field
                label="Tu nombre"
                autoComplete="name"
                error={errors.name?.message}
                {...register('name')}
              />
            )}
            <Field
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              inputMode="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="password-field">
              <Field
                label="Contraseña"
                type={visible ? 'text' : 'password'}
                autoComplete={registering ? 'new-password' : 'current-password'}
                error={errors.password?.message}
                hint={
                  registering
                    ? 'Al menos 8 caracteres, una mayúscula, una minúscula y un número.'
                    : undefined
                }
                {...register('password')}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button type="submit" busy={isSubmitting}>
              {registering ? 'Crear mi cuenta' : 'Entrar a QSale'}
              <ArrowUpRight size={19} />
            </Button>
          </form>
          <p className="auth-switch">
            {registering ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}{' '}
            <Link
              to={
                (registering ? '/login' : '/register') + '?returnTo=' + encodeURIComponent(returnTo)
              }
            >
              {registering ? 'Inicia sesión' : 'Crea tu cuenta'}
            </Link>
          </p>
        </div>
        <p className="auth-footer">Organizarse también puede ser parte del buen plan.</p>
      </section>
    </main>
  );
}

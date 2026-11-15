import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { locationSchema, type Location } from '@qsale/contracts';
import { api, useSession } from '../session';
import { Button, Field, PageHeading, useToast } from '../ui';
import { LocationPicker } from '../Map';

export default function Profile() {
  const { user, updateUser } = useSession();
  const [name, setName] = useState(user!.name);
  const [location, setLocation] = useState<Location | null>(user!.location);
  const [locationValid, setLocationValid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const cache = useQueryClient();
  return (
    <div className="form-page">
      <PageHeading
        title="Tu punto de partida"
        description="Tu grupo te reconoce por tu nombre. Tu ubicación ayuda a encontrar un lugar más conveniente."
      />
      <form
        className="surface"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          if (!locationValid) {
            setError('Completa ambas coordenadas válidas antes de guardar.');
            return;
          }
          if (name.trim().length < 2 || name.trim().length > 100) {
            setError('Tu nombre debe tener entre 2 y 100 caracteres.');
            return;
          }
          if (location && !locationSchema.safeParse(location).success) {
            setError('Revisa las coordenadas: latitud de −90 a 90, longitud de −180 a 180.');
            return;
          }
          setBusy(true);
          try {
            const updated = await api.updateMe({
              name: name.trim(),
              ...(location ? { location } : { removeLocation: true }),
            });
            updateUser(updated);
            await cache.invalidateQueries();
            toast('Tu perfil está actualizado.');
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Nombre"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          label="Correo electrónico"
          value={user!.email}
          readOnly
          hint="Tu correo identifica tu cuenta."
        />
        <h2>Tu ubicación de referencia</h2>
        <p>
          Usa un punto cercano, como tu distrito o una avenida. No necesitas compartir tu casa. El
          grupo verá el punto medio y las estimaciones agregadas.
        </p>
        <LocationPicker
          value={location}
          onChange={setLocation}
          onValidityChange={setLocationValid}
        />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button busy={busy} disabled={!locationValid}>
            Guardar mi perfil
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  genderLabels,
  locationSchema,
  profileSchema,
  todayInLima,
  type Gender,
  type Location,
} from '@qsale/contracts';
import { api, useSession } from '../session';
import { Button, Field, PageHeading, SelectField, useToast } from '../ui';
import { LocationPicker } from '../Map';
import { Avatar, prepareAvatar } from '../Avatar';

export default function Profile() {
  const { user, updateUser } = useSession();
  const [name, setName] = useState(user!.name);
  const [surname, setSurname] = useState(user!.surname ?? '');
  const [nickname, setNickname] = useState(user!.nickname ?? '');
  const [phone, setPhone] = useState(user!.phone ?? '');
  const [birthDate, setBirthDate] = useState(user!.birthDate ?? '');
  const [gender, setGender] = useState<Gender | ''>(user!.gender ?? '');
  const [location, setLocation] = useState<Location | null>(user!.location);
  const [locationValid, setLocationValid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const cache = useQueryClient();
  const profile = profileSchema.safeParse({
    name,
    surname,
    nickname,
    phone,
    birthDate: birthDate || null,
    gender: gender || null,
  });
  // Errors appear next to each field while typing.
  const fieldError = (field: string) =>
    profile.success
      ? undefined
      : profile.error.issues.find((issue) => issue.path[0] === field)?.message;
  const fullName = [user!.name, user!.surname].filter(Boolean).join(' ');

  const changePhoto = async (chosen: File | undefined) => {
    if (!chosen) return;
    setPhotoBusy(true);
    try {
      updateUser(await api.updateAvatar(await prepareAvatar(chosen)));
      toast('Tu foto está actualizada.');
    } catch (failure) {
      toast((failure as Error).message, true);
    } finally {
      setPhotoBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  return (
    <div className="form-page">
      <PageHeading
        title="Tu punto de partida"
        description="Así te ve tu grupo en los planes. Tu ubicación ayuda a encontrar un lugar más conveniente."
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
          if (!profile.success) {
            setError('Revisa los campos marcados en rojo.');
            return;
          }
          if (location && !locationSchema.safeParse(location).success) {
            setError('Revisa las coordenadas: latitud de −90 a 90, longitud de −180 a 180.');
            return;
          }
          setBusy(true);
          try {
            // One after the other: both write the same user, so running them together could undo a change.
            await api.updateMe({
              name: profile.data.name,
              ...(location ? { location } : { removeLocation: true }),
            });
            const updated = await api.updateProfile({
              name: profile.data.name,
              surname: profile.data.surname || null,
              nickname: profile.data.nickname || null,
              phone: profile.data.phone || null,
              birthDate: profile.data.birthDate,
              gender: profile.data.gender,
            });
            updateUser(updated);
            await cache.invalidateQueries();
            toast('Tu perfil está actualizado.');
          } catch (failure) {
            setError((failure as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="profile-photo">
          <Avatar userId={user!.id} version={user!.avatarVersion} name={fullName} size={84} />
          <div className="actions">
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => void changePhoto(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              busy={photoBusy}
              onClick={() => file.current?.click()}
            >
              {user!.avatarVersion ? 'Cambiar foto' : 'Agregar foto'}
            </Button>
            {Boolean(user!.avatarVersion) && (
              <Button
                type="button"
                variant="quiet"
                disabled={photoBusy}
                onClick={() =>
                  void api
                    .deleteAvatar()
                    .then(updateUser)
                    .catch((failure) => toast((failure as Error).message, true))
                }
              >
                Quitar foto
              </Button>
            )}
          </div>
        </div>
        <Field
          label="¿Cómo te llaman tus amigos?"
          placeholder="Lau, Pipe, Cami, Mari"
          maxLength={30}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          error={fieldError('nickname')}
          hint="Así te verán en los planes. Si lo dejas vacío, usaremos tu nombre."
        />
        <div className="form-row">
          <Field
            label="Nombre"
            autoComplete="given-name"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldError('name')}
          />
          <Field
            label="Apellido"
            autoComplete="family-name"
            maxLength={100}
            value={surname}
            onChange={(event) => setSurname(event.target.value)}
            error={fieldError('surname')}
          />
        </div>
        <Field
          label="Correo electrónico"
          value={user!.email}
          readOnly
          hint="Tu correo identifica tu cuenta y no se puede cambiar."
        />
        <div className="form-row">
          <Field
            label="Teléfono móvil"
            type="tel"
            autoComplete="tel"
            placeholder="+51 987 654 321"
            maxLength={20}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={fieldError('phone')}
          />
          <Field
            label="Fecha de nacimiento"
            type="date"
            max={todayInLima()}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            error={fieldError('birthDate')}
          />
        </div>
        <SelectField
          label="Género"
          value={gender}
          onChange={(event) => setGender(event.target.value as Gender | '')}
        >
          <option value="">Sin especificar</option>
          {(Object.entries(genderLabels) as [Gender, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <h2>Tu ubicación de referencia</h2>
        <p>
          Usa un punto cercano, como tu distrito o una avenida. No necesitas compartir tu casa. El
          grupo verá el punto medio y las estimaciones agregadas. Es tu dirección principal también
          en la app móvil.
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

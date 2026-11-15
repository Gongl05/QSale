import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@qsale/api-client';
import type { User } from '@qsale/contracts';
import { api, useSession } from '../session';
import { useAction } from '../hooks';
import { Button, ConfirmDialog, ErrorState, Field, PageHeading, Skeleton } from '../ui';

export default function Admin() {
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<User | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: ({ signal }) => api.users(signal),
    enabled: user?.role === 'ADMIN',
  });
  const change = useAction(
    (target: User) => api.updateRole(target.id, target.role === 'ADMIN' ? 'USER' : 'ADMIN'),
    'Rol actualizado.',
    () => setTarget(null),
  );
  if (user?.role !== 'ADMIN')
    return (
      <ErrorState error={new ApiError('Solo los administradores pueden ver esta pantalla.', 403)} />
    );
  return (
    <>
      <PageHeading
        title="Administración"
        description="Gestiona los accesos con cuidado: un administrador puede gestionar todos los planes."
      />
      <Field
        label="Buscar usuario por nombre o correo"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {query.data
                .filter((item) =>
                  (item.name + ' ' + item.email).toLowerCase().includes(search.toLowerCase()),
                )
                .map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{item.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</td>
                    <td>
                      <Button variant="secondary" onClick={() => setTarget(item)}>
                        {item.role === 'ADMIN' ? 'Cambiar a usuario' : 'Hacer administrador'}
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {target && (
        <ConfirmDialog
          title="¿Cambiar este acceso?"
          description={`${target.name} pasará a ser ${target.role === 'ADMIN' ? 'usuario' : 'administrador'}. Este cambio afecta sus permisos inmediatamente.`}
          action="Cambiar rol"
          busy={change.isPending}
          onConfirm={() => change.mutate(target)}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}

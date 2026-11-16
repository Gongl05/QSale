import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Geography, PlanOption } from '@qsale/contracts';
import { MapView, type MapPoint } from '../Map';
import { EmptyState } from '../ui';
import { DataSection } from './PlanDetailCards';
export function PlanMapSection({
  geography,
  options,
}: {
  geography: UseQueryResult<Geography, Error>;
  options: PlanOption[];
}) {
  const points: MapPoint[] = options
    .filter((option) => option.type === 'PLACE' && option.location)
    .map((option) => ({ ...option.location!, label: option.label }));
  if (geography.data?.midpoint)
    points.push({
      ...geography.data.midpoint,
      label: 'Punto medio del grupo',
      midpoint: true,
    });
  return (
    <>
      <h2>Un punto para encontrarse</h2>
      <p>
        El punto medio usa las ubicaciones de referencia del grupo. Es una orientación geográfica;
        no calcula una ruta de encuentro. Aparece cuando al menos dos integrantes guardan una
        ubicación.
      </p>
      <DataSection query={geography}>
        {(geo) => (
          <>
            <p className="map-summary">
              {geo.locatedParticipants} de {geo.joinedParticipants} integrantes tienen ubicación.{' '}
              <Link to="/profile">Actualizar la mía</Link>
            </p>
            {points.length ? (
              <MapView points={points} />
            ) : (
              <EmptyState title="El mapa está esperando sus ideas">
                Añadan ubicaciones de referencia o propongan un lugar para empezar.
              </EmptyState>
            )}
          </>
        )}
      </DataSection>
    </>
  );
}

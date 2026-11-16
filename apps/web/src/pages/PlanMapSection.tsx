import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Geography, PlanOption } from "@qsale/contracts";
import { MapView, type MapPoint } from "../Map";
import { EmptyState } from "../ui";
import { DataSection } from "./PlanDetailCards";
export function PlanMapSection({
  geography,
  options,
}: {
  geography: UseQueryResult<Geography, Error>;
  options: PlanOption[];
}) {
  const points: MapPoint[] = options
    .filter((option) => option.type === "PLACE" && option.location)
    .map((option) => ({ ...option.location!, label: option.label }));
  if (geography.data?.midpoint)
    points.push({
      ...geography.data.midpoint,
      label: "Punto medio del grupo",
      midpoint: true,
    });
  return (
    <>
      <h2>Lugares propuestos</h2>
      <p>
        El punto medio usa las ubicaciones de referencia del grupo. Es una
        orientación geográfica; no calcula una ruta de encuentro. Aparece cuando
        al menos dos integrantes guardan una ubicación.
      </p>
      <DataSection query={geography}>
        {(geo) => (
          <>
            <p className="map-summary">
              {geo.locatedParticipants} de {geo.joinedParticipants} integrantes
              tienen ubicación de referencia. Las estimaciones usan las
              ubicaciones disponibles; no representan necesariamente a todo el
              grupo. <Link to="/profile">Actualizar la mía</Link>
            </p>
            {points.length ? (
              <>
                <MapView points={points} />
                <details className="optional-fields">
                  <summary>Ver ubicaciones en lista</summary>
                  <ul className="map-locations">
                    {points.map((point, index) => (
                      <li key={index}>
                        <strong>{point.label}</strong>{" "}
                        <span>
                          {point.latitude.toFixed(5)},{" "}
                          {point.longitude.toFixed(5)}
                        </span>{" "}
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=16/${point.latitude}/${point.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir ${point.label} en OpenStreetMap (otra pestaña)`}
                        >
                          Abrir ubicación
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <EmptyState title="Todavía no hay lugares en el mapa">
                Añadan ubicaciones de referencia o propongan un lugar para
                empezar.
              </EmptyState>
            )}
          </>
        )}
      </DataSection>
    </>
  );
}

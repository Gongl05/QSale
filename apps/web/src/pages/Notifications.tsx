import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarCheck, Check, Mail, RefreshCw } from "lucide-react";
import { formatDate } from "@qsale/contracts";
import { api } from "../session";
import { useAction, usePagination } from "../hooks";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeading,
  Pagination,
  Skeleton,
} from "../ui";

export default function Notifications() {
  const pager = usePagination();
  const unreadOnly = pager.params.get("unread") === "true";
  const filters = { page: pager.page, size: pager.size, unreadOnly };
  const query = useQuery({
    queryKey: ["notifications", filters],
    queryFn: ({ signal }) => api.notifications(filters, signal),
  });
  const read = useAction(
    (id: number) => api.markRead(id),
    "Notificación marcada como leída.",
  );
  useEffect(() => {
    if (query.data && pager.page > 0 && !query.data.content.length)
      pager.update({ page: String(Math.max(1, query.data.totalPages)) }, true);
  }, [query.data, pager.page]);
  return (
    <>
      <PageHeading
        title="Notificaciones"
        description={
          query.data
            ? `${query.data.unreadCount} ${query.data.unreadCount === 1 ? "notificación" : "notificaciones"} sin leer`
            : "Invitaciones, cambios y planes que ya salieron."
        }
      />
      <div className="notification-filter">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) =>
              pager.update({
                unread: event.target.checked ? "true" : undefined,
                page: "1",
              })
            }
          />
          Solo sin leer
        </label>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.content.length ? (
        <EmptyState title="Todo al día">
          Las novedades de tus planes aparecerán aquí.
        </EmptyState>
      ) : (
        <div className="notification-list">
          {query.data.content.map((item) => (
            <article
              className={"notification-row " + (!item.readAt ? "unread" : "")}
              key={item.id}
            >
              <span className="notification-icon">
                {item.type === "PLAN_INVITATION" ? (
                  <Mail size={20} />
                ) : item.type === "PLAN_CLOSED" ? (
                  <CalendarCheck size={20} />
                ) : item.type === "RESCHEDULE_APPLIED" ||
                  item.type === "PLAN_UPDATED" ? (
                  <RefreshCw size={20} />
                ) : (
                  <Bell size={20} />
                )}
              </span>
              <div>
                <p>{item.message}</p>
                <small className="notification-status">
                  {item.readAt ? "Leída" : "Sin leer"} ·{" "}
                  <time dateTime={item.createdAt}>
                    {formatDate(item.createdAt, true)}
                  </time>
                </small>
                {item.planId && (
                  <Link to={"/plans/" + item.planId}>Ver plan</Link>
                )}
              </div>
              {!item.readAt && (
                <Button
                  variant="quiet"
                  busy={read.isPending && read.variables === item.id}
                  onClick={() => read.mutate(item.id)}
                  aria-label={"Marcar como leída: " + item.message}
                >
                  <Check size={19} />
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {query.data && <Pagination {...query.data} onChange={pager.onChange} />}
    </>
  );
}

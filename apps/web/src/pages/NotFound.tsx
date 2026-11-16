import { Link } from "react-router-dom";
import { EmptyState } from "../ui";
export default function NotFound() {
  return (
    <main className="standalone">
      <EmptyState
        title="No encontramos esta página"
        action={
          <Link className="button primary" to="/plans">
            Ir a mis planes
          </Link>
        }
      >
        La página no existe o el enlace cambió. Puedes volver y encontrar a tu
        grupo desde allí.
      </EmptyState>
    </main>
  );
}

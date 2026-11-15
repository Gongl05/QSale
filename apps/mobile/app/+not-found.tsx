import { useRouter } from 'expo-router';
import { Button, EmptyState, Screen } from '../src/ui';
export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <EmptyState title="Este camino no lleva a un plan">
        La página no existe o el enlace cambió.
      </EmptyState>
      <Button onPress={() => router.replace('/')}>Ir a mis planes</Button>
    </Screen>
  );
}

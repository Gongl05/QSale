import type Feather from '@expo/vector-icons/Feather';
import type { PlanType } from '@qsale/contracts';

interface PlanTheme {
  background: string;
  color: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}

/** One color and icon per kind of plan, so a list of plans reads at a glance. Text colors pass AA on their background. */
export const planThemes: Record<PlanType, PlanTheme> = {
  DINNER: { background: '#FFE6D2', color: '#8A3505', icon: 'coffee' },
  PARTY: { background: '#FBE3EE', color: '#8E1B52', icon: 'gift' },
  TRIP: { background: '#D9F1EE', color: '#0C5E57', icon: 'map' },
  SPORTS: { background: '#E1F2DC', color: '#2B6322', icon: 'activity' },
  CULTURAL: { background: '#ECE6F7', color: '#55358F', icon: 'music' },
  STUDY: { background: '#E0ECFA', color: '#1D528D', icon: 'book-open' },
  OTHER: { background: '#FFF3DD', color: '#7F3D12', icon: 'star' },
};

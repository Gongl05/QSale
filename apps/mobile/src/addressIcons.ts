import type Feather from '@expo/vector-icons/Feather';
import type { AddressType } from '@qsale/contracts';

export const addressIcons: Record<AddressType, React.ComponentProps<typeof Feather>['name']> = {
  HOME: 'home',
  WORK: 'briefcase',
  OTHER: 'map-pin',
};

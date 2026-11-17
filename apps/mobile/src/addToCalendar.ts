import { Linking, Platform } from 'react-native';
// The new expo-calendar API is not available in Expo Go; the legacy one opens the system dialog everywhere.
import * as Calendar from 'expo-calendar/legacy';
import { calendarTimes, googleCalendarUrl, type CalendarPlan } from '@qsale/contracts';

export { calendarTimes };

/**
 * Opens the phone's "new event" screen with the plan filled in, so the person picks which
 * calendar to save it to (Google, iCloud, Outlook...). Returns false when there is no agreed date.
 */
export async function addPlanToCalendar(plan: CalendarPlan) {
  const times = calendarTimes(plan);
  const link = googleCalendarUrl(plan);
  if (!times || !link) return false;
  if (Platform.OS === 'web') {
    await Linking.openURL(link);
    return true;
  }
  const location = [plan.agreedPlace, plan.agreedAddress].filter(Boolean).join(', ');
  try {
    await Calendar.createEventInCalendarAsync({
      title: plan.name,
      startDate: times.startDate,
      endDate: times.endDate,
      allDay: times.allDay,
      location: location || undefined,
      notes: plan.description || 'Plan coordinado en QSale.',
      timeZone: 'America/Lima',
    });
  } catch {
    // No calendar app or the dialog is unavailable: Google Calendar in the browser still works.
    await Linking.openURL(link);
  }
  return true;
}

import { NotificationList } from "@/components/notifications/NotificationList";

export const metadata = { title: "Notifications" };

export default function Page() {
  return <NotificationList settingsHref="/settings" />;
}

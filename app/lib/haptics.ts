import { isNativePlatform } from "./capacitor-utils";

type ImpactStyle = "Heavy" | "Medium" | "Light";

/**
 * Trigger haptic feedback on native platforms.
 * No-op on web.
 */
export async function hapticImpact(style: ImpactStyle = "Medium") {
  if (!isNativePlatform) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle[style] });
  } catch {
    // Silently fail if haptics not available
  }
}

/**
 * Trigger a notification haptic on native platforms.
 */
export async function hapticNotification(type: "Success" | "Warning" | "Error" = "Success") {
  if (!isNativePlatform) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType[type] });
  } catch {
    // Silently fail
  }
}

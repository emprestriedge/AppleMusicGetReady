import { Haptics as CapHaptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
}

export const Haptics = {
  triggerHaptic: async () => {
    try {
      await CapHaptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
  },

  impactAsync: async (style: ImpactFeedbackStyle) => {
    try {
      const capStyle = 
        style === ImpactFeedbackStyle.Light ? ImpactStyle.Light :
        style === ImpactFeedbackStyle.Heavy ? ImpactStyle.Heavy :
        ImpactStyle.Medium;
      await CapHaptics.impact({ style: capStyle });
    } catch (e) {}
  },

  success: async () => {
    try {
      await CapHaptics.notification({ type: NotificationType.Success });
    } catch (e) {}
  },

  error: async () => {
    try {
      await CapHaptics.notification({ type: NotificationType.Error });
    } catch (e) {}
  },

  light: () => Haptics.impactAsync(ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(ImpactFeedbackStyle.Heavy),
  impact: () => Haptics.impactAsync(ImpactFeedbackStyle.Heavy),
};
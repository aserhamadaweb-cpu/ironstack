import { detectPwaPlatform, type PwaPlatform } from '@/lib/pwa-client'

/** Asset folders under `public/install-tutorial/`. */
export const INSTALL_TUTORIAL_ASSET_ROOT = '/install-tutorial'

export type InstallTutorialPlatform = 'ios' | 'android' | 'windows' | 'generic'

export type InstallTutorialStepDef = {
  /** Stable id — maps to i18n keys under installTutorial.{platform}.{id} */
  id: string
  /** Public URL under /install-tutorial/{platform}/. Null = placeholder slot. */
  imageSrc: string | null
}

/** Step order + image filenames per platform. Drop screenshots into matching folders. */
export const INSTALL_TUTORIAL_STEP_DEFS: Record<
  InstallTutorialPlatform,
  InstallTutorialStepDef[]
> = {
  ios: [
    {
      id: 'step1',
      imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/ios/step-1-share.jpg`,
    },
    {
      id: 'step2',
      imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/ios/step-2-add-to-home-screen.jpg`,
    },
  ],
  android: [
    { id: 'step1', imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/android/step-1-menu.jpg` },
    { id: 'step2', imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/android/step-2-install.jpg` },
  ],
  windows: [
    { id: 'step1', imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/windows/step-1-install-icon.jpg` },
    { id: 'step2', imageSrc: `${INSTALL_TUTORIAL_ASSET_ROOT}/windows/step-2-confirm.jpg` },
  ],
  generic: [],
}

export function mapPwaPlatformToTutorial(
  platform: PwaPlatform,
): InstallTutorialPlatform {
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  if (platform === 'desktop' && typeof window !== 'undefined') {
    if (/Windows/i.test(window.navigator.userAgent)) return 'windows'
  }
  return 'generic'
}

export function detectInstallTutorialPlatform(): InstallTutorialPlatform {
  return mapPwaPlatformToTutorial(detectPwaPlatform())
}

export function tutorialStepsForPlatform(
  platform: InstallTutorialPlatform,
): InstallTutorialStepDef[] {
  return INSTALL_TUTORIAL_STEP_DEFS[platform] ?? []
}

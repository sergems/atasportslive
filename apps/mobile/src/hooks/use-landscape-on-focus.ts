import React from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Live video screens follow the video in landscape, but must give the device
 * back to the rest of the app when the user leaves. Tab screens stay mounted,
 * so a plain mount/unmount effect would leave the whole app stuck landscape.
 */
export function useLandscapeOnFocus() {
  useFocusEffect(
    React.useCallback(() => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';

const HIDE_DELAY = 3500;

/** Auto-hiding overlay state: controls stay visible while paused, fade out during playback. */
export function useControlsVisibility(playing: boolean) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    setVisible(true);
    clear();
    timer.current = setTimeout(() => setVisible(false), HIDE_DELAY);
  }, [clear]);

  const toggle = useCallback(() => {
    if (visible) {
      clear();
      setVisible(false);
    } else {
      show();
    }
  }, [visible, clear, show]);

  useEffect(() => {
    clear();
    if (playing) {
      // Playback state comes from native player events, so this effect is the
      // only place to react to it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      show();
      return clear;
    }
    setVisible(true);
    return clear;
  }, [playing, show, clear]);

  return { visible, show, toggle };
}

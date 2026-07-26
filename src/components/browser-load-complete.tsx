'use client';

import { useEffect } from 'react';

export function BrowserLoadComplete() {
  useEffect(() => {
    window.stop();
    const frame = window.requestAnimationFrame(() => {
      document.documentElement.classList.remove('relay-loading');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';
import { initGlobalErrorListeners } from '@/lib/error-reporter';

export default function TelemetryInitializer() {
  useEffect(() => {
    initGlobalErrorListeners();
  }, []);

  return null;
}

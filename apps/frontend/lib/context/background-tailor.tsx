'use client';

import React, { createContext, useContext, useState } from 'react';

interface BackgroundTailorJob {
  resumeId: string;
}

interface BackgroundTailorContextValue {
  job: BackgroundTailorJob | null;
  setJob: (job: BackgroundTailorJob | null) => void;
}

const BackgroundTailorContext = createContext<BackgroundTailorContextValue>({
  job: null,
  setJob: () => {},
});

export function BackgroundTailorProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<BackgroundTailorJob | null>(null);
  return (
    <BackgroundTailorContext.Provider value={{ job, setJob }}>
      {children}
    </BackgroundTailorContext.Provider>
  );
}

export function useBackgroundTailor() {
  return useContext(BackgroundTailorContext);
}

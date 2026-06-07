'use client';

import { App, ConfigProvider } from 'antd';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 6,
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
} 
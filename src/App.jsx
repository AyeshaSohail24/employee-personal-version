import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { SessionProvider } from './state/SessionContext';
import { RoleProvider } from './state/RoleContext';
import { NotificationProvider } from './state/NotificationContext';

export default function App() {
  return (
    <SessionProvider>
      <RoleProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </RoleProvider>
    </SessionProvider>
  );
}

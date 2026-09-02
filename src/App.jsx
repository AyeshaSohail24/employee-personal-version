import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { RoleProvider } from './state/RoleContext';

export default function App() {
  return (
    <RoleProvider>
      <RouterProvider router={router} />
    </RoleProvider>
  );
}

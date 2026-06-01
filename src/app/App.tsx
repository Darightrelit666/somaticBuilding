import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { I18nProvider } from '../shared/i18n/I18nProvider';

export default function App() {
  return (
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  );
}

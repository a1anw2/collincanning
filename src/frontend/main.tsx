/** Frontend entry point. */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './globals.css';
import { HomeRedirect } from './pages/HomeRedirect';
import { Viewer } from './pages/Viewer';
import { Admin } from './pages/Admin';
import { Dashboard } from './admin/Dashboard';
import { Personas } from './admin/Personas';
import { PersonaEditor } from './admin/PersonaEditor';
import { SimControl } from './admin/SimControl';
import { AiUsage } from './admin/AiUsage';
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/w/:workspaceId" element={<Viewer />} />
        <Route path="/admin" element={<Admin />}>
          <Route index element={<Dashboard />} />
          <Route path="personas" element={<Personas />} />
          <Route path="personas/:id" element={<PersonaEditor />} />
          <Route path="sim" element={<SimControl />} />
          <Route path="usage" element={<AiUsage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

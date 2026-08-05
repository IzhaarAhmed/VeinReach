import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { queryClient } from './lib/queryClient.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { PreferencesProvider } from './context/PreferencesContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';
// After index.css on purpose: the landing's cinematic palette must outrank the
// app's light/high-contrast utility remaps on source order.
import './styles/landing.css';
// Builds on the lux tokens defined in landing.css, so it must follow it.
import './styles/auth.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <PreferencesProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

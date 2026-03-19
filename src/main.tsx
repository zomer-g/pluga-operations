import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './components/auth/AuthProvider';
import { seedDatabase } from './db/seed';
import './index.css';

// Seed default data on first launch
seedDatabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);

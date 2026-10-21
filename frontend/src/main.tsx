import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { apiClient, init, Layout, queryClient, ThemeProvider } from './shared'
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { MainPage } from './pages';
import { Entrypoint, Header } from './widgets';
import { RoleProvider, SessionProvider } from './entities';

init().then(async (data) => {
  if (import.meta.env.VITE_API_MOCKS === 'true') {
    const { enableMocks } = await import('./mocks');
    enableMocks(apiClient);
  }
  return data
}).then(data => 
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RoleProvider roles={data}>
            <SessionProvider>
              <Entrypoint />
              <Layout>
                <Header />
                <MainPage />
              </Layout>
            </SessionProvider>
            <Toaster />
          </RoleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
))

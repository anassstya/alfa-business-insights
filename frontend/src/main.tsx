import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Layout, queryClient, ThemeProvider } from './shared'
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { MainPage } from './pages';
import { Header } from './widgets';


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Layout>
          <Header />
          <MainPage />
        </Layout>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

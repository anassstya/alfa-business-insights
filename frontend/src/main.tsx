import { lazy, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Layout, queryClient, ThemeProvider } from './shared'
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Entrypoint, Header } from './widgets';
import { RoleProvider, SessionProvider } from './entities';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

// eslint-disable-next-line react-refresh/only-export-components
const MainPage = lazy(() => import('@/pages/MainPage'))
// eslint-disable-next-line react-refresh/only-export-components
const AlfaMainPage = lazy(() => import('@/pages/AlfaMainPage'))
// eslint-disable-next-line react-refresh/only-export-components
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RoleProvider>
          <SessionProvider>
            <BrowserRouter>
            <Routes>
              <Route
                path='/' 
                element={<AlfaMainPage />}
              />
              <Route
                path='/insights'
                element={
                  <>
                    <Entrypoint />
                    <Layout>
                      <Header />
                      <MainPage />
                    </Layout>
                  </>
                }
                />
              <Route
                path='/insights/analysis/:jobId'
                element={
                  <Layout>
                    <Header />
                    <AnalysisPage />
                  </Layout>
                }
              />
              </Routes>
            </BrowserRouter>
          </SessionProvider>
          <Toaster />
        </RoleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)

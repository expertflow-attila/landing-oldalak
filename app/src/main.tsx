import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { seedIfEmpty } from './db/seed'
import DashboardPage from './pages/DashboardPage'
import BudgetPage from './pages/BudgetPage'
import TransactionsPage from './pages/TransactionsPage'
import ImportPage from './pages/ImportPage'
import SecondOpinionPage from './pages/SecondOpinionPage'
import WishlistPage from './pages/WishlistPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import SettingsPage from './pages/SettingsPage'
import './styles/tokens.css'
import './styles/base.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'keret', element: <BudgetPage /> },
      { path: 'tranzakciok', element: <TransactionsPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'megvegyem', element: <SecondOpinionPage /> },
      { path: 'kivansaglista', element: <WishlistPage /> },
      { path: 'elofizetesek', element: <SubscriptionsPage /> },
      { path: 'beallitasok', element: <SettingsPage /> },
    ],
  },
])

seedIfEmpty().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
})

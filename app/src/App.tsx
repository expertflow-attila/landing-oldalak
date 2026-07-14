import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { isPersisted, requestPersistence } from './db/persistence'

const NAV_ITEMS = [
  { to: '/', label: 'Áttekintés' },
  { to: '/keret', label: 'Keretek' },
  { to: '/tranzakciok', label: 'Tranzakciók' },
  { to: '/import', label: 'Import' },
  { to: '/megvegyem', label: 'Megvegyem?' },
  { to: '/kivansaglista', label: 'Kívánságlista' },
  { to: '/elofizetesek', label: 'Előfizetések' },
  { to: '/beallitasok', label: 'Beállítások' },
]

export default function App() {
  const [persisted, setPersisted] = useState(true)

  useEffect(() => {
    requestPersistence().then(() => isPersisted().then(setPersisted))
  }, [])

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          Keret
          <small>tudatos költségvetés</small>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        {!persisted && (
          <div className="banner warning">
            A böngésző nem garantálja az adataid tartós tárolását — készíts rendszeresen
            mentést a Beállítások oldalon.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { AuthProvider } from './context/AuthContext'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import { LeaguePage } from './pages/LeaguePage'
import { LoginPage } from './pages/LoginPage'
import './App.css'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <div className="app">
          <AppHeader />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/join/:token" element={<JoinPage />} />
            <Route path="/league/:leagueId" element={<LeaguePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

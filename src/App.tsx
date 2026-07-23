import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import { LeaguePage } from './pages/LeaguePage'
import { LoginPage } from './pages/LoginPage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/join/:token" element={<JoinPage />} />
            <Route path="/league/:leagueId" element={<LeaguePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  )
}

export default App

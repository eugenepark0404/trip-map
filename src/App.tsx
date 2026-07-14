import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MapProvider } from './context/MapContext'
import { DiaryProvider } from './context/DiaryContext'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { HomePage } from './pages/HomePage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MapProvider>
          <DiaryProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <HomePage />
                  </RequireAuth>
                }
              />
            </Routes>
          </DiaryProvider>
        </MapProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

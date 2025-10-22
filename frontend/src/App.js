import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import GoogleAuthCallback from './components/GoogleAuthCallback';
import Landing from './pages/Landing';
import Login from './pages/Login';
import EmailVerification from './pages/EmailVerification';
import VerifyCode from './pages/VerifyCode';
import Members from './pages/Members';
import Scores from './pages/Scores';
import Points from './pages/Points';
import TeamAssignment from './pages/TeamAssignment';
import UserManagement from './pages/UserManagement';
import MyPage from './pages/MyPage';
import { SpeedInsights } from '@vercel/speed-insights/react';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-email" element={<EmailVerification />} />
            <Route path="/verify-code" element={<VerifyCode />} />
            <Route path="/google-callback" element={<GoogleAuthCallback />} />
            <Route
              path="/members"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Members />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scores"
              element={
                <ProtectedRoute requiredRole="user">
                  <Scores />
                </ProtectedRoute>
              }
            />
            <Route
              path="/points"
              element={
                <ProtectedRoute requiredRole="user">
                  <Points />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-assignment"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TeamAssignment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-management"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mypage"
              element={
                <ProtectedRoute requiredRole="user">
                  <MyPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <SpeedInsights />
      </div>
    </AuthProvider>
  );
}

export default App;

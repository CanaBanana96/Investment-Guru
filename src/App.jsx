import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import GoalSetting from './components/GoalSetting';

function AppRoutes() {
  const { user, isGuest } = useAuth();
  const [userGoal, setUserGoal] = useState('growth');
  const [userRisk, setUserRisk] = useState('medium');

  const handleGoalSelect = (goal, risk) => {
    setUserGoal(goal);
    setUserRisk(risk);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={user || isGuest ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/goal-setting"
        element={
          <ProtectedRoute>
            <GoalSetting onGoalSelect={handleGoalSelect} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard initialGoal={userGoal} initialRisk={userRisk} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user || isGuest ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <ToastContainer position="top-center" theme="colored" />
    </AuthProvider>
  );
}

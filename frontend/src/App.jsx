import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Requests from './pages/Requests.jsx';
import CreateRequest from './pages/CreateRequest.jsx';
import FindDonors from './pages/FindDonors.jsx';
import Profile from './pages/Profile.jsx';
import Messages from './pages/Messages.jsx';
import Chat from './pages/Chat.jsx';
import Notifications from './pages/Notifications.jsx';
import Donations from './pages/Donations.jsx';
import BloodBanks from './pages/BloodBanks.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import BloodBankPortal from './pages/BloodBankPortal.jsx';
import HospitalPortal from './pages/HospitalPortal.jsx';
import NotFound from './pages/NotFound.jsx';

/* The landing page carries the 3D scene and framer-motion. Splitting it out
   keeps ~40 kB gzipped of animation code off every authenticated route. */
const Landing = lazy(() => import('./pages/Landing.jsx'));

export default function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route
        path="/"
        element={
          /* Fallback paints the landing's black canvas so there is no flash
             between the app shell and the cinematic page. */
          <Suspense fallback={<div className="lux" />}>
            <Landing />
          </Suspense>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Authenticated app */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/new" element={<CreateRequest />} />
        <Route path="donors" element={<FindDonors />} />
        <Route path="profile" element={<Profile />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:id" element={<Chat />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="donations" element={<Donations />} />
        <Route path="blood-banks" element={<BloodBanks />} />

        {/* Role portals */}
        <Route
          path="admin"
          element={
            <RoleRoute roles={['admin']}>
              <AdminDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="bloodbank"
          element={
            <RoleRoute roles={['bloodbank']}>
              <BloodBankPortal />
            </RoleRoute>
          }
        />
        <Route
          path="hospital"
          element={
            <RoleRoute roles={['hospital']}>
              <HospitalPortal />
            </RoleRoute>
          }
        />
      </Route>

      <Route path="404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

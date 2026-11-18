import { createBrowserRouter, Navigate } from 'react-router-dom';
import PlaceholderPage from '../pages/PlaceholderPage.jsx';
import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import RoleRoute from './RoleRoute.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from '../components/AsyncState.jsx';
import CitizenLayout from '../layouts/CitizenLayout.jsx';
import CitizenDashboard from '../pages/citizen/CitizenDashboard.jsx';
import MyComplaints from '../pages/citizen/MyComplaints.jsx';
import ReportComplaint from '../pages/citizen/ReportComplaint.jsx';
import ComplaintDetails from '../pages/citizen/ComplaintDetails.jsx';
import Announcements from '../pages/citizen/Announcements.jsx';
import AnnouncementDetails from '../pages/citizen/AnnouncementDetails.jsx';
import Profile from '../pages/citizen/Profile.jsx';
import HelpSupport from '../pages/citizen/HelpSupport.jsx';
import ManageAnnouncements from '../pages/admin/ManageAnnouncements.jsx';

function HomeRoute() {
  const { user, isLoading } = useAuth();
  const roleRoute = { CITIZEN: '/citizen', OFFICER: '/officer', ADMIN: '/admin' }[user?.role];
  if (isLoading) return <main className="grid min-h-screen place-items-center bg-[#f7f6ef] p-6"><LoadingState>Checking your session...</LoadingState></main>;
  return roleRoute ? <Navigate to={roleRoute} replace /> : <PlaceholderPage />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeRoute />
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/register',
    element: <Register />
  },
  {
    path: '/citizen',
    element: <ProtectedRoute><RoleRoute allowedRoles={['CITIZEN']}><CitizenLayout /></RoleRoute></ProtectedRoute>,
    children: [
      { index: true, element: <CitizenDashboard /> },
      { path: 'complaints', element: <MyComplaints /> },
      { path: 'complaints/new', element: <ReportComplaint /> },
      { path: 'complaints/:id', element: <ComplaintDetails /> },
      { path: 'announcements', element: <Announcements /> },
      { path: 'announcements/:id', element: <AnnouncementDetails /> },
      { path: 'profile', element: <Profile /> },
      { path: 'help', element: <HelpSupport /> }
    ]
  },
  {
    path: '/officer',
    element: (
      <ProtectedRoute>
        <RoleRoute allowedRoles={['OFFICER']}>
          <PlaceholderPage />
        </RoleRoute>
      </ProtectedRoute>
    )
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <RoleRoute allowedRoles={['ADMIN']}>
          <PlaceholderPage />
        </RoleRoute>
      </ProtectedRoute>
    )
  },
  {
    path: '/admin/announcements',
    element: <ProtectedRoute><RoleRoute allowedRoles={['ADMIN']}><ManageAnnouncements /></RoleRoute></ProtectedRoute>
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);

import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import CitizenPreferencesSync from './context/CitizenPreferencesSync.jsx';
import { router } from './routes/AppRouter.jsx';

// Provides authentication state to the application route tree.
export default function App() {
  return (
    <AuthProvider>
      <CitizenPreferencesSync />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppProvider } from './context/AppContext';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { CardsPage } from './pages/CardsPage';
import { EditorPage } from './pages/EditorPage';
import { FoldersPage } from './pages/FoldersPage';
import { HomePage } from './pages/HomePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TakePage } from './pages/TakePage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="atamalar" element={<AssignmentsPage />} />
            <Route path="klasorler" element={<FoldersPage />} />
            <Route path="klasorler/:folderId" element={<FoldersPage />} />
            <Route path="duzenle/:id" element={<EditorPage />} />
            <Route path="coz/:id" element={<TakePage />} />
            <Route path="kartlar/:id" element={<CardsPage />} />
            <Route path="raporlar" element={<ReportsPage />} />
            <Route path="kullanicilar" element={<UsersPage />} />
            <Route path="ayarlar" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}

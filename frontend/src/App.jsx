// frontend/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";

// USER PAGES
import Dashboard from "./components/dashboard/dashboard.jsx";
import Visualizer from "./components/visualizer/visualizer.jsx";
import Devices from "./components/devices/devices.jsx";
import DeviceDetail from "./components/devices/deviceControl.jsx/deviceControl.jsx";
import Logs from "./components/Logs/logs.jsx";
import Issues from "./components/issues/issues.jsx";
import Features from "./components/Features/features.jsx";
import Scan from "./components/scan/scan.jsx";
import TaskManager from "./components/devices/Taskmanager/taskmanager.jsx";
import UsbControl from "./components/usb/usb.jsx";
import InstalledApps from "./components/devices/installedApps/installedapps.jsx";
import Profile from "./components/profile/Profile.jsx";
import FileMonitor from "./components/FileMonitor/filemonitor.jsx";

// AUTH & ADMIN
import Login from "./components/navigation/Login.jsx";
import Register from "./components/navigation/Register.jsx";
import CreateUser from "./components/admin/CreateUser.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import ManageTenants from "./components/admin/ManageTenants.jsx";
import LicenseManager from "./components/admin/LicenseManager.jsx";
// import ManageUsers from "./components/admin/ManageUsers.jsx"; // create later

// PUBLIC PAGES
import Download from "./components/download/Download.jsx";

// TOKEN HELPERS
import { getToken, getRole } from "./utils/authService.js";

// LAYOUT WRAPPER
import Layout from "./components/navigation/Layout.jsx";
import { apiGet } from "./utils/api.js";
import { Toaster } from "./utils/toast.jsx";
import "./utils/toast.css";

// ------------------------------------------------------
// 🔐 PROTECTED ROUTES
// ------------------------------------------------------

// Block access if no token
function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

// Full Layout with Sidebar and TopNav
function ProtectedLayout({ children, adminOnly = false }) {
  const content = adminOnly ? (
    <AdminRoute>{children}</AdminRoute>
  ) : (
    children
  );

  return (
    <ProtectedRoute>
      <Layout>{content}</Layout>
    </ProtectedRoute>
  );
}

// Block access if not admin
function AdminRoute({ children }) {
  return getRole() === "admin" ? (
    children
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

// Block access if feature is lead-locked
function FeatureGate({ children, featureId }) {
  const [unlockedFeatures, setUnlockedFeatures] = React.useState({});
  const [checking, setChecking] = React.useState(true);

  // Re-check on every mount to ensure fresh state from DB
  React.useEffect(() => {
    let isMounted = true;
    const verifyAccess = async () => {
      try {
        const response = await apiGet("/api/features");
        if (response.ok && isMounted) {
          const data = await response.json();
          const unlockedMap = {};
          if (data && data.unlockedFeatures) {
            data.unlockedFeatures.forEach(id => unlockedMap[id] = true);
          }
          setUnlockedFeatures(unlockedMap);
        }
      } catch (err) {
        console.error("Access verification failed:", err);
      } finally {
        if (isMounted) setChecking(false);
      }
    };
    verifyAccess();
    return () => { isMounted = false; };
  }, []);

  if (getRole() === "admin") return children; // Admins see everything

  if (checking) return null; // or a loading spinner

  if (!unlockedFeatures[featureId]) {
    return <Navigate to="/features" replace />;
  }

  return children;
}

// ------------------------------------------------------
// 🌐 MAIN APP ROUTER
// ------------------------------------------------------
function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* PROTECTED DOWNLOAD PAGE */}
        <Route
          path="/download"
          element={
            <ProtectedLayout>
              <Download />
            </ProtectedLayout>
          }
        />
        {/* USER DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        {/* ADMIN DASHBOARD */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedLayout adminOnly={true}>
              <AdminDashboard />
            </ProtectedLayout>
          }
        />
        {/* ADMIN: MANAGE USERS */}
        <Route
          path="/admin/tenants"
          element={
            <ProtectedLayout adminOnly={true}>
              <ManageTenants />
            </ProtectedLayout>
          }
        />
        {/* ADMIN: CREATE USER */}
        <Route
          path="/admin/create-user"
          element={
            <ProtectedLayout adminOnly={true}>
              <CreateUser />
            </ProtectedLayout>
          }
        />
        {/* ADMIN: LICENSE MANAGER */}
        <Route
          path="/admin/licenses"
          element={
            <ProtectedLayout adminOnly={true}>
              <LicenseManager />
            </ProtectedLayout>
          }
        />
        {/* USER ROUTES */}
        <Route
          path="/visualizer"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="visualizer">
                <Visualizer />
              </FeatureGate>
            </ProtectedLayout>
          }
        />

        <Route
          path="/devices"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="devices">
                <Devices />
              </FeatureGate>
            </ProtectedLayout>
          }
        />
        <Route
          path="/devices/:id"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="devices">
                <DeviceDetail />
              </FeatureGate>
            </ProtectedLayout>
          }
        />
        <Route
          path="/tasks/:id"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="tasks">
                <TaskManager />
              </FeatureGate>
            </ProtectedLayout>
          }
        />
        <Route
          path="/apps/:id"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="apps">
                <InstalledApps />
              </FeatureGate>
            </ProtectedLayout>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="logs">
                <Logs />
              </FeatureGate>
            </ProtectedLayout>
          }
        />

        <Route
          path="/features"
          element={
            <ProtectedLayout>
              <Features />
            </ProtectedLayout>
          }
        />
        <Route
          path="/scan"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="scan">
                <Scan />
              </FeatureGate>
            </ProtectedLayout>
          }
        />
        <Route
          path="/usb"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="usb">
                <UsbControl />
              </FeatureGate>
            </ProtectedLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedLayout>
              <Profile />
            </ProtectedLayout>
          }
        />
        <Route
          path="/file-monitor"
          element={
            <ProtectedLayout>
              <FeatureGate featureId="filemonitor">
                <FileMonitor />
              </FeatureGate>
            </ProtectedLayout>
          }
        />

        {/* DEFAULT REDIRECT */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

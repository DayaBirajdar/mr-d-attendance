import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import "./App.css";

import Sidebar from "./components/inventory/layout/Sidebar";
import Footer from "./components/inventory/layout/Footer";

import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import RecycleBin from "./pages/RecycleBin";
import Expenses from "./pages/Expenses";
import Vendors from "./pages/Vendors";
import Documents from "./pages/Documents";
import Events from "./pages/Events";
import Visitors from "./pages/Visitors";
import Renewals from "./pages/Renewals";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";

// Employee-only attendance page
import EmployeeAttendance from "./pages/EmployeeAttendance";

import CommandPalette from "./components/command/CommandPalette";

function App() {
  const location = useLocation();

  const [commandOpen, setCommandOpen] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | EMPLOYEE ATTENDANCE MODE
  |--------------------------------------------------------------------------
  */

  const isEmployeeAttendancePage =
    location.pathname === "/employee-attendance";

  /*
  |--------------------------------------------------------------------------
  | COMMAND PALETTE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    function handleKeyDown(e) {
      /*
       * Disable command palette completely
       * on employee attendance page.
       */

      if (isEmployeeAttendancePage) {
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();

        setCommandOpen(true);
      }

      if (e.key === "Escape") {
        setCommandOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isEmployeeAttendancePage]);

  /*
  |--------------------------------------------------------------------------
  | EMPLOYEE ATTENDANCE PAGE
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | Employee page is completely separated
  | from the admin dashboard.
  |
  | NO SIDEBAR
  | NO DASHBOARD
  | NO COMMAND PALETTE
  | NO ADMIN MENU
  |
  |--------------------------------------------------------------------------
  */

  if (isEmployeeAttendancePage) {
    return (
      <Routes>
        <Route
          path="/employee-attendance"
          element={<EmployeeAttendance />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/employee-attendance"
              replace
            />
          }
        />
      </Routes>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ADMIN APPLICATION
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <div className="layout">

        <Sidebar />

        <main className="content">

          <Routes>

            <Route
              path="/"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />

            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/inventory"
              element={<Inventory />}
            />

            <Route
              path="/employees"
              element={<Employees />}
            />

            <Route
              path="/attendance"
              element={<Attendance />}
            />

            <Route
              path="/recycle-bin"
              element={<RecycleBin />}
            />

            <Route
              path="/expenses"
              element={<Expenses />}
            />

            <Route
              path="/vendors"
              element={<Vendors />}
            />

            <Route
              path="/documents"
              element={<Documents />}
            />

            <Route
              path="/events"
              element={<Events />}
            />

            <Route
              path="/visitors"
              element={<Visitors />}
            />

            <Route
              path="/renewals"
              element={<Renewals />}
            />

            <Route
              path="/ai"
              element={
                <h2>
                  🤖 AI Assistant (Coming Soon)
                </h2>
              }
            />

            <Route
              path="/settings"
              element={
                <h2>
                  ⚙️ Settings (Coming Soon)
                </h2>
              }
            />

            <Route
              path="*"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />

          </Routes>

        </main>

      </div>

      <Footer />

      <CommandPalette
        open={commandOpen}
        onClose={() =>
          setCommandOpen(false)
        }
      />
    </>
  );
}

export default App;
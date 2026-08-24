import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { supabase } from "./lib/supabase";
import { useEffect, useState } from "react";

import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import "./App.css";

import Header from "./components/inventory/layout/Header";
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
import LeaveManagement from "./pages/LeaveManagement";
import AI from "./pages/AI";

// Employee-only attendance page
import EmployeeAttendance from "./pages/EmployeeAttendance";

import CommandPalette from "./components/command/CommandPalette";


function App() {

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("mrd-theme") ||
      "light";

    document.documentElement.setAttribute(
      "data-theme",
      savedTheme
    );
  }, []);
  const location = useLocation();

  const [commandOpen, setCommandOpen] =
    useState(false);

  const [session, setSession] =
    useState(null);

  const [authLoading, setAuthLoading] =
    useState(true);


  // ---------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;

        setSession(
          data.session || null
        );

        setAuthLoading(false);
      });

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          setSession(
            nextSession
          );

          setAuthLoading(false);
        }
      );

    return () => {
      mounted = false;

      authListener.subscription.unsubscribe();
    };
  }, []);


  // ---------------------------------------------------------
  // EMPLOYEE ATTENDANCE MODE
  // ---------------------------------------------------------

  const isEmployeeAttendancePage =
    location.pathname ===
    "/employee-attendance";


  // ---------------------------------------------------------
  // COMMAND PALETTE
  // ---------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e) {
      if (
        isEmployeeAttendancePage
      ) {
        return;
      }

      if (
        (e.ctrlKey ||
          e.metaKey) &&
        e.key.toLowerCase() ===
          "k"
      ) {
        e.preventDefault();

        setCommandOpen(true);
      }

      if (
        e.key ===
        "Escape"
      ) {
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
  }, [
    isEmployeeAttendancePage,
  ]);


  // ---------------------------------------------------------
  // EMPLOYEE ATTENDANCE PAGE
  // ---------------------------------------------------------

  if (
    isEmployeeAttendancePage
  ) {
    return (
      <Routes>

        <Route
          path="/employee-attendance"
          element={
            <EmployeeAttendance />
          }
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


  // ---------------------------------------------------------
  // ADMIN LOGIN
  // ---------------------------------------------------------

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
        }}
      >
        Loading Mr.D...
      </div>
    );
  }


  if (!session) {
    return (
      <Routes>

        <Route
          path="/login"
          element={
            <Login />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>
    );
  }


  if (
    location.pathname ===
    "/login"
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }


  // ---------------------------------------------------------
  // ADMIN APPLICATION
  // ---------------------------------------------------------

  return (
    <>
      <Header />

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
              element={
                <Dashboard />
              }
            />


            <Route
              path="/inventory"
              element={
                <Inventory />
              }
            />


            <Route
              path="/employees"
              element={
                <Employees />
              }
            />


            <Route
              path="/attendance"
              element={
                <Attendance />
              }
            />


            <Route
              path="/leaves"
              element={
                <LeaveManagement />
              }
            />


            <Route
              path="/recycle-bin"
              element={
                <RecycleBin />
              }
            />


            <Route
              path="/expenses"
              element={
                <Expenses />
              }
            />


            <Route
              path="/vendors"
              element={
                <Vendors />
              }
            />


            <Route
              path="/documents"
              element={
                <Documents />
              }
            />


            <Route
              path="/events"
              element={
                <Events />
              }
            />


            <Route
              path="/visitors"
              element={
                <Visitors />
              }
            />


            <Route
              path="/renewals"
              element={
                <Renewals />
              }
            />


            <Route
              path="/ai"
              element={
                <AI />
              }
            />


            <Route
              path="/settings"
              element={
                <Settings />
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
        open={
          commandOpen
        }

        onClose={() =>
          setCommandOpen(
            false
          )
        }
      />

    </>
  );
}


export default App;
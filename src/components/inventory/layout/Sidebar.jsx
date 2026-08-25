import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";

import {
  FiHome,
  FiBox,
  FiTrash2,
  FiDollarSign,
  FiCalendar,
  FiUsers,
  FiUser,
  FiCpu,
  FiSettings,
  FiLogOut,
  FiBell,
  FiClock,
  FiClipboard,
  FiFileText,
} from "react-icons/fi";

function Sidebar() {

  const navigate =
    useNavigate();

  async function handleLogout() {

    const {
      data: { session },
    } =
      await supabase.auth.getSession();

    const userId =
      session?.user?.id;

    if (userId) {
      const cachePrefix =
        `mrd-cache:${userId}:`;

      Object.keys(localStorage)
        .filter((key) =>
          key.startsWith(
            cachePrefix
          )
        )
        .forEach((key) =>
          localStorage.removeItem(
            key
          )
        );
    }

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout error:",
        error
      );

      alert(
        "Unable to logout."
      );

      return;
    }

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }

  return (
    <aside className="sidebar">

      <div className="sidebar-top">

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiHome />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiBox />
          <span>Inventory</span>
        </NavLink>

        <NavLink
          to="/employees"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiUsers />
          <span>Employees</span>
        </NavLink>

        <NavLink
          to="/attendance"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiClock />
          <span>Attendance</span>
        </NavLink>

        <NavLink
          to="/leaves"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiClipboard />
          <span>Leave Management</span>
        </NavLink>

        <NavLink
          to="/recycle-bin"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiTrash2 />
          <span>Recycle Bin</span>
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiDollarSign />
          <span>Expenses</span>
        </NavLink>

        <NavLink
          to="/events"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiCalendar />
          <span>Events</span>
        </NavLink>

        <NavLink
          to="/vendors"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiUsers />
          <span>Vendors</span>
        </NavLink>


        <NavLink
          to="/documents"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiFileText />
          <span>Documents</span>
        </NavLink>

        <NavLink
          to="/visitors"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiUser />
          <span>Visitors</span>
        </NavLink>

        <NavLink
          to="/renewals"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiBell />
          <span>Renewals</span>
        </NavLink>

        <NavLink
          to="/ai"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiCpu />
          <span>AI Assistant</span>
        </NavLink>

      </div>

      <div className="sidebar-bottom">

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `menu ${isActive ? "active" : ""}`
          }
        >
          <FiSettings />
          <span>Settings</span>
        </NavLink>

        <button
          className="logout-btn"
          onClick={handleLogout}
        >
          <FiLogOut />
          <span>Logout</span>
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;
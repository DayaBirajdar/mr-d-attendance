import { NavLink } from "react-router-dom";

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
} from "react-icons/fi";

function Sidebar() {
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

        <button className="logout-btn">
          <FiLogOut />
          <span>Logout</span>
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;
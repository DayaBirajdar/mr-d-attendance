import "./CommandPalette.css";
import { useNavigate } from "react-router-dom";

function CommandPalette({ open, onClose }) {

  const navigate = useNavigate();

  if (!open) return null;

  const commands = [

    {
      icon: "🏠",
      title: "Dashboard",
      action: () => navigate("/dashboard"),
    },

    {
      icon: "📦",
      title: "Inventory",
      action: () => navigate("/inventory"),
    },

    {
      icon: "🗑️",
      title: "Recycle Bin",
      action: () => navigate("/recycle-bin"),
    },

    {
      icon: "💰",
      title: "Expenses",
      action: () => navigate("/expenses"),
    },

    {
      icon: "👥",
      title: "Vendors",
      action: () => navigate("/vendors"),
    },

    {
      icon: "📄",
      title: "Documents",
      action: () => navigate("/documents"),
    },

    {
      icon: "📅",
      title: "Events",
      action: () => navigate("/events"),
    },

    {
      icon: "🤖",
      title: "AI Assistant",
      action: () => navigate("/ai"),
    },

  ];

  return (

    <div className="command-overlay" onClick={onClose}>

      <div
        className="command-box"
        onClick={(e) => e.stopPropagation()}
      >

        <input
          className="command-input"
          placeholder="Search Mr.D..."
          autoFocus
        />

        <div className="command-results">

          {commands.map((cmd, index) => (

            <div
              key={index}
              className="command-item"
              onClick={() => {
                cmd.action();
                onClose();
              }}
            >
              <span>{cmd.icon}</span>

              <span>{cmd.title}</span>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}

export default CommandPalette;
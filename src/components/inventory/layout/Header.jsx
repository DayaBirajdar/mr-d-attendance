import { useEffect, useState } from "react";
import "../../../styles/header.css";
import teamPossibleLogo from "../../../assets/team-possible-logo.jpg";
import SearchBar from "../../common/SearchBar";

function Header() {

  const [theme, setTheme] =
    useState(() => {
      return (
        localStorage.getItem("mrd-theme") ||
        "light"
      );
    });

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    localStorage.setItem(
      "mrd-theme",
      theme
    );
  }, [theme]);

  function toggleTheme() {
    setTheme(
      (current) =>
        current === "dark"
          ? "light"
          : "dark"
    );
  }

  return (
    <header className="header">

      <div className="brand">
        <img
          src="/mrd-ai-logo.svg"
          alt="Mr.D AI"
          className="mrd-logo"
        />

        <div className="brand-text">
          <h1>Mr.D</h1>
          <p>AI Operations Platform</p>
        </div>
      </div>

      <SearchBar />

      <button
        type="button"
        className="theme-toggle-btn"
        onClick={toggleTheme}
        title={
          theme === "dark"
            ? "Switch to Light Mode"
            : "Switch to Dark Mode"
        }
        aria-label={
          theme === "dark"
            ? "Switch to Light Mode"
            : "Switch to Dark Mode"
        }
      >
        <span className="theme-toggle-icon">
          {theme === "dark"
            ? "☀️"
            : "🌙"}
        </span>

        <span className="theme-toggle-label">
          {theme === "dark"
            ? "Light"
            : "Dark"}
        </span>
      </button>

      <div className="user-profile">
        <img
          src={teamPossibleLogo}
          alt="Team Possible Sports"
          className="team-possible-logo"
        />

        <div className="user-section">
          <div className="user-name">
            Daya Birajdar
          </div>

          <div className="user-role">
            Operations Specialist
          </div>

          <div className="user-company">
            Team Possible
          </div>
        </div>
      </div>

    </header>
  );
}

export default Header;

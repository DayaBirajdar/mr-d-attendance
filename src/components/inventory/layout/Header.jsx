import "../../../styles/header.css";
import logo from "../../../assets/team-possible-logo.jpg";
import SearchBar from "../../common/SearchBar";

function Header() {
  return (
    <header className="header">

      <div className="brand">
        <img
          src={logo}
          alt="Team Possible"
          className="logo"
        />

        <div>
          <h1>🤖 Mr.D</h1>
          <p>AI Operations Platform</p>
        </div>
      </div>

      <SearchBar />

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

    </header>
  );
}

export default Header;
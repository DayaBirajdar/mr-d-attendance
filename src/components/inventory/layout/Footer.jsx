import teamPossibleLogo from "../../../assets/team-possible-logo.jpg";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">

      <div className="footer-brand-block">

        <img
          src={teamPossibleLogo}
          alt="Team Possible Sports"
          className="footer-team-logo"
        />

        <div className="footer-brand-text">

          <strong>
            Mr.D AI Operations Platform
          </strong>

          <span>
            © {year} Team Possible
          </span>

          <span className="footer-motto">
            Nothing is Impossible
          </span>

        </div>

      </div>

    </footer>
  );
}

export default Footer;

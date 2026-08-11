function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-left">
        <strong>Mr.D AI Operations Platform</strong>
      </div>

      <div className="footer-center">
        © {year} Team Possible
      </div>

      <div className="footer-right">
        Nothing is Impossible 🚀
      </div>
    </footer>
  );
}

export default Footer;
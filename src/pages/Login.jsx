import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setLoading(false);

    if (error) {
      console.error("Login error:", error);

      setErrorMessage(
        "Invalid email or password."
      );

      return;
    }

    navigate(
      "/dashboard",
      {
        replace: true,
      }
    );
  }

  return (
    <div className="mrd-login-page">

      <div className="mrd-login-card">

        <div className="mrd-login-brand">

          <img
            src="/mrd-ai-logo.svg"
            alt="Mr.D"
            className="mrd-login-logo"
          />

          <div>
            <h1>Mr.D</h1>
            <p>
              AI Operations Platform
            </p>
          </div>

        </div>

        <h2>
          Welcome Back
        </h2>

        <p className="mrd-login-subtitle">
          Sign in to continue to your Operations Dashboard.
        </p>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={
              email
            }
            onChange={
              (e) =>
                setEmail(
                  e.target.value
                )
            }
            required
            autoComplete="email"
          />

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter your password"
            value={
              password
            }
            onChange={
              (e) =>
                setPassword(
                  e.target.value
                )
            }
            required
            autoComplete="current-password"
          />

          {errorMessage && (
            <div className="mrd-login-error">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            className="mrd-login-button"
            disabled={
              loading
            }
          >
            {loading
              ? "Signing In..."
              : "Sign In"}
          </button>

        </form>

        <div className="mrd-login-footer">
          © 2026 Team Possible
          <br />
          Nothing is Impossible 🚀
        </div>

      </div>

    </div>
  );
}

export default Login;

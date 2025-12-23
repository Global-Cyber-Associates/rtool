// frontend/src/components/navigation/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../../utils/authService";
import { updateSocketToken } from "../../utils/socket";
import logo from "../../assets/gca.png";
import "./login.css";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await loginUser(email, password);

    if (res.token) {
      const role = sessionStorage.getItem("role");
      updateSocketToken(res.token);

      if (role === "admin") navigate("/admin/dashboard");
      else navigate("/dashboard");
    } else {
      setError(res.message || "Login failed");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src={logo} alt="GCA Logo" className="login-logo" />

        <h2 className="login-title">VisuN</h2>
        <h4 className="login-title2"> @ powered by AI</h4>
        <p className="login-subtitle">Please login to continue</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="login-btn">
            Login
          </button>

          <div className="registration-prompt" style={{ marginTop: "24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px" }}>
            <p style={{ color: "#a8dadc", fontSize: "0.9rem", marginBottom: "10px" }}>
              New to VisuN?
            </p>
            <Link
              to="/register"
              className="register-link-btn"
              style={{
                color: "#1f8ef1",
                fontWeight: "600",
                textDecoration: "none",
                fontSize: "1rem",
                display: "inline-block",
                padding: "8px 16px",
                border: "1px solid #1f8ef1",
                borderRadius: "6px",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#1f8ef1";
                e.target.style.color = "#fff";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "transparent";
                e.target.style.color = "#1f8ef1";
              }}
            >
              Request Client Account
            </Link>
          </div>
        </form>
      </div>
      <div className="login-footer">© 2025 Global Cyber Associates</div>
    </div>
  );
}

export default Login;

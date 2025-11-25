import React, { useState } from "react";
import "./Setup.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const Setup = () => {
  const [mongoURI, setMongoURI] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSetup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${backendUrl}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mongoURI, adminUsername, adminPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Setup completed! Redirecting to login...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        setMessage(`❌ Setup failed: ${data.message}`);
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-box">
        <h2 className="setup-title">🚀 Initial Setup</h2>
        <p className="setup-subtitle">Enter your MongoDB connection string.</p>

        <form onSubmit={handleSetup} className="setup-form">
          <div className="form-group">
            <label>MongoDB URI</label>
            <input
              type="text"
              value={mongoURI}
              onChange={(e) => setMongoURI(e.target.value)}
              placeholder="mongodb+srv://<user>:<pass>@cluster.mongodb.net/db"
              required
            />
          </div>

          {/* <div className="divider" /> */}
          <p className="setup-subtitle">Create the first ADMIN account.</p>

          <div className="form-group">
            <label>Admin Username</label>
            <input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="Enter admin username"
              required
            />
          </div>

          <div className="form-group">
            <label>Admin Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter admin password"
              required
            />
          </div>

          <button className="setup-btn" type="submit" disabled={loading}>
            {loading ? "Setting up..." : "Save & Continue"}
          </button>
        </form>

        {message && (
          <p
            className={`setup-message ${
              message.startsWith("✅") ? "success" : "error"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default Setup;

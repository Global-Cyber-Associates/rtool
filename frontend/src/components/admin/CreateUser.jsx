// frontend/src/components/admin/CreateUser.jsx
import React, { useState } from "react";
import { apiPost } from "../../utils/api";
import { toast } from "../../utils/toast";

function CreateUser() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await apiPost("/api/users/create", {
        name,
        email,
        password,
        role,
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("User created successfully!");
        setName("");
        setEmail("");
        setPassword("");
        setRole("client");
      } else {
        toast.error(data.message || "Failed to create user");
      }
    } catch (err) {
      toast.error("Network error during user creation.");
    }
  };

  return (
    <div className="create-user-content">
      <div className="create-user-form-container" style={{ maxWidth: 500, margin: "50px auto", padding: 20, background: "#112d4e", borderRadius: 12 }}>
        <h2>Create New User</h2>


        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 15 }}>
            <label>Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 15 }}>
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 15 }}>
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 15 }}>
            <label>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            >
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px",
              background: "#28a745",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Create User
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateUser;

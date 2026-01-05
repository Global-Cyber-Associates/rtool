import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut, apiDelete } from "../../utils/api";
import { toast } from "../../utils/toast";
import "./ManageUsers.css";

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  const loggedInEmail = sessionStorage.getItem("email");

  // Load users
  const loadUsers = async () => {
    try {
      const res = await apiGet("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      toast.error("Network error: Could not load identity database.");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Enable / Disable user
  const toggleStatus = async (user) => {
    const confirmMsg = user.isActive
      ? `Disable user ${user.email}?`
      : `Enable user ${user.email}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await apiPut(`/api/users/${user._id}`, {
        isActive: !user.isActive,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Identity status updated: ${user.email} is now ${!user.isActive ? 'Inactive' : 'Active'}.`);
        loadUsers();
      } else {
        toast.error(data.message || "Credential status update failed.");
      }
    } catch (err) {
      toast.error("Internal process error during status toggle.");
    }
  };

  // Delete user
  const deleteUser = async (user) => {
    if (user.email === loggedInEmail) {
      toast.error("Authorization Error: Domain admins cannot self-delete.");
      return;
    }

    if (!window.confirm(`Delete user ${user.email}?`)) return;

    try {
      const res = await apiDelete(`/api/users/${user._id}`);
      const data = await res.json();
      if (res.ok) {
        toast.success(`Identity Purged: ${user.email} removed from infrastructure.`);
        loadUsers();
      } else {
        toast.error(data.message || "Purge operation failed.");
      }
    } catch (err) {
      toast.error("Backend Error: Identity could not be removed.");
    }
  };

  return (
    <div className="manage-users-content">
      <div className="manage-users">
        <div className="header-row">
          <h2>Manage Users</h2>
          <button
            className="add-user-btn"
            onClick={() => navigate("/admin/create-user")}
          >
            + Add New User
          </button>
        </div>


        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u._id} className={!u.isActive ? "disabled-row" : ""}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>

                <td>
                  <span
                    className={u.isActive ? "status-active" : "status-disabled"}
                  >
                    {u.isActive ? "Active" : "Disabled"}
                  </span>
                </td>

                <td>
                  <button
                    className={u.isActive ? "disable-btn" : "enable-btn"}
                    onClick={() => toggleStatus(u)}
                  >
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                </td>

                <td>
                  <button
                    className="delete-btn"
                    disabled={u.email === loggedInEmail}
                    onClick={() => deleteUser(u)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManageUsers;

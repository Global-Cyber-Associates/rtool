import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../../utils/api";
import { User, Shield, Lock, Key, AlertCircle, CheckCircle, X } from "lucide-react";
import "./profile.css";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorpc, setErrorpc] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await apiGet("/api/auth/me");
        const data = await res.json();
        if (res.ok) setProfile(data);
        else setErrorpc(data.message || "Failed to load profile");
      } catch (err) {
        setErrorpc("Connection lost. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (newPassword !== confirmPassword) {
      return setPassError("New passwords do not match");
    }

    if (newPassword.length < 6) {
      return setPassError("Password must be at least 6 characters");
    }

    setUpdating(true);
    try {
      const res = await apiPut("/api/auth/change-password", {
        oldPassword,
        newPassword,
      });
      const data = await res.json();

      if (res.ok) {
        setPassSuccess("Password updated successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // Keep success message visible for a bit then close?
        setTimeout(() => {
          setIsModalOpen(false);
          setPassSuccess("");
        }, 2000);
      } else {
        setPassError(data.message || "Failed to update password");
      }
    } catch (err) {
      setPassError("Server error. Please try again later.");
    } finally {
      setUpdating(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPassError("");
    setPassSuccess("");
  };

  if (loading) return (
    <div className="profile-content-wrapper">
      <div className="profile-container" style={{ textAlign: 'center', padding: '50px' }}>
        <p style={{ color: '#8ca8b3' }}>Synchronizing profile data...</p>
      </div>
    </div>
  );

  return (
    <div className="profile-content-wrapper">
      <div className="profile-container">

        {/* HEADER */}
        <div className="profile-header">
          <div className="profile-avatar-circle">
            {profile?.name?.charAt(0).toUpperCase() || <User size={40} />}
          </div>
          <h2>{profile ? profile.name : "User Account"}</h2>
          <p>{profile ? profile.email : "Loading..."}</p>
        </div>

        <div className="profile-body">
          {errorpc && <div className="error-msg"><AlertCircle size={18} /> {errorpc}</div>}

          {/* SECTION 1: PERSONAL INFO */}
          <div className="profile-section">
            <div className="profile-section-title">
              <User size={18} /> Account Information
            </div>
            <div className="profile-grid">
              <div className="profile-info-item">
                <label>Full Name</label>
                <div className="profile-info-content">{profile?.name}</div>
              </div>
              <div className="profile-info-item">
                <label>Email Address</label>
                <div className="profile-info-content">{profile?.email}</div>
              </div>
              <div className="profile-info-item">
                <label>System Role</label>
                <div className="profile-info-content" style={{ textTransform: 'capitalize' }}>
                  {profile?.role}
                </div>
              </div>
              <div className="profile-info-item">
                <label>Account Status</label>
                <div className={`status-pill ${profile?.isActive ? 'active' : 'disabled'}`}>
                  <div className="status-dot"></div>
                  {profile?.isActive ? 'Active' : 'Disabled'}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: SECURITY / PASSWORD TRIGGER */}
          <div className="profile-section" style={{ marginBottom: 0 }}>
            <div className="profile-section-title">
              <Shield size={18} /> Privacy & Security
            </div>

            <div className="security-controls">
              <p style={{ color: '#8ca8b3', fontSize: '14px', marginBottom: '20px' }}>
                Maintain your account security by periodically updating your password.
              </p>
              <button
                className="primary-btn security-btn"
                onClick={() => setIsModalOpen(true)}
              >
                <Key size={16} /> Change Account Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Lock size={20} /> Change Password</h3>
              <button className="close-btn" onClick={closeModal}><X size={20} /></button>
            </div>

            <div className="modal-body">
              {passError && <div className="error-msg"><AlertCircle size={18} /> {passError}</div>}
              {passSuccess && <div className="success-msg"><CheckCircle size={18} /> {passSuccess}</div>}

              <form className="profile-form" onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label>Current Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type="password"
                      placeholder="Enter current password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type="password"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="cancel-btn" onClick={closeModal}>Cancel</button>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={updating || !oldPassword || !newPassword || !confirmPassword}
                  >
                    {updating ? "Processing..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;

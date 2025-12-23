import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Settings, LogOut } from "lucide-react";
import "./topnav.css";
import { logoutUser } from "../../utils/authService";

const TopNav = () => {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const name = sessionStorage.getItem("name");
    const email = sessionStorage.getItem("email");

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        logoutUser();
        navigate("/login");
    };

    return (
        <div className="topnav">
            <div className="topnav-content">
                {/* Spacer for left side */}
                <div></div>

                {/* Profile Section - Right side */}
                <div className="topnav-profile" ref={dropdownRef}>
                    <button
                        className="profile-button"
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        <div className="profile-icon">
                            <User size={20} />
                        </div>
                        <span className="profile-name">{name || "User"}</span>
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <div className="profile-dropdown">
                            <div className="dropdown-header">
                                <div className="dropdown-name">{name || "Unknown User"}</div>
                                <div className="dropdown-email">{email}</div>
                            </div>
                            <div className="dropdown-divider"></div>
                            <button
                                className="dropdown-item"
                                onClick={() => {
                                    navigate("/profile");
                                    setShowDropdown(false);
                                }}
                            >
                                <User size={16} />
                                <span>My Profile</span>
                            </button>
                            <button
                                className="dropdown-item"
                                onClick={() => {
                                    navigate("/profile/change-password");
                                    setShowDropdown(false);
                                }}
                            >
                                <Settings size={16} />
                                <span>Change Password</span>
                            </button>
                            <div className="dropdown-divider"></div>
                            <button className="dropdown-item logout" onClick={handleLogout}>
                                <LogOut size={16} />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopNav;

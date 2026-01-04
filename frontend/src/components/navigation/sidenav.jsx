import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Menu, X, LayoutDashboard, Monitor, Smartphone,
  Usb, Scan, ClipboardList, Star, ShieldCheck, Users,
  Download, LogOut, User as UserIcon, Lock, Key
} from "lucide-react";

import "./sidenav.css";
import Logo from "../../assets/gca.png";
import { getRole, logoutUser } from "../../utils/authService";
import { apiGet } from "../../utils/api";

const Sidebar = ({ onToggle, isOpen: controlledIsOpen }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const navigate = useNavigate();

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (val) => {
    if (controlledIsOpen !== undefined) {
      if (onToggle) onToggle(val);
    } else {
      setInternalIsOpen(val);
      if (onToggle) onToggle(val);
    }
  };

  const role = getRole();
  const name = sessionStorage.getItem("name") || "User";
  const email = sessionStorage.getItem("email");

  const [unlockedFeatures, setUnlockedFeatures] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchUnlockedFeatures = async () => {
      try {
        const response = await apiGet("/api/features");
        if (response.ok && isMounted) {
          const data = await response.json();
          const unlockedMap = {};
          if (data && data.unlockedFeatures) {
            data.unlockedFeatures.forEach(id => unlockedMap[id] = true);
          }
          setUnlockedFeatures(unlockedMap);
          localStorage.setItem("unlockedFeatures", JSON.stringify(unlockedMap));
        }
      } catch (err) {
        console.error("Failed to fetch sidebar features:", err);
      }
    };
    fetchUnlockedFeatures();
    return () => { isMounted = false; };
  }, []);

  // Effect to listen for storage changes (triggered by features.jsx)
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("unlockedFeatures");
      if (saved) setUnlockedFeatures(JSON.parse(saved));
    };
    window.addEventListener("storage", handleStorageChange);
    // Poll less frequently or use a custom event. 
    // Since handleUnlock in features.jsx updates localStorage, 
    // and storage events don't trigger in the same window, we poll every 2s for same-window updates.
    const interval = setInterval(handleStorageChange, 2000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const clientNavItems = [
    { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={20} />, alwaysShow: true },
    { label: "Visualizer", path: "/visualizer", icon: <Monitor size={20} />, id: "visualizer" },
    { label: "Devices", path: "/devices", icon: <Smartphone size={20} />, id: "devices" },
    { label: "USB Control", path: "/usb", icon: <Usb size={20} />, id: "usb" },
    { label: "Scanner", path: "/scan", icon: <Scan size={20} />, id: "scan" },
    { label: "Logs", path: "/logs", icon: <ClipboardList size={20} />, id: "logs" },
    { label: "Features", path: "/features", icon: <Star size={20} />, alwaysShow: true },
    { label: "Download", path: "/download", icon: <Download size={20} />, alwaysShow: true },
  ];

  // Logic to handle click on possibly locked items
  const handleProtectedNavigation = (e, item) => {
    if (role === "admin" || item.alwaysShow || unlockedFeatures[item.id]) {
      // Allow navigation
      if (window.innerWidth < 1024) setIsOpen(false);
      return;
    }

    // Locked: Prevent default navigation and go to features
    e.preventDefault();
    navigate("/features");
    if (window.innerWidth < 1024) setIsOpen(false);
  };


  const adminNavItems = [
    { label: "Admin Dashboard", path: "/admin/dashboard", icon: <ShieldCheck size={20} /> },
    { label: "Manage Users", path: "/admin/users", icon: <Users size={20} /> },
    { label: "License Manager", path: "/admin/licenses", icon: <Key size={20} /> },
    { label: "Download", path: "/download", icon: <Download size={20} /> },
  ];

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  useEffect(() => {
    if (onToggle) onToggle(isOpen);
  }, [isOpen, onToggle]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsOpen(false);
      else setIsOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Toggle Button */}
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <div className="sidebar-top-section">
          {/* Logo */}
          <div className="sidebar-header">
            <img src={Logo} alt="GCA" className="sidebar-logo" />
            {isOpen && <h1 className="company-name">Global Cyber Associates</h1>}
          </div>

          {/* NAV LINKS */}
          <ul className="sidebar-nav">
            {(role === "admin" ? adminNavItems : clientNavItems).map((item, idx) => {
              const isLocked = role !== "admin" && !item.alwaysShow && !unlockedFeatures[item.id];
              return (
                <li key={idx}>
                  <NavLink
                    to={item.path}
                    onClick={(e) => handleProtectedNavigation(e, item)}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""} ${!isOpen ? "mini" : ""} ${isLocked ? "nav-locked" : ""}`
                    }
                    title={!isOpen ? item.label : ""}
                    end
                  >
                    <span className="nav-icon">
                      {isLocked ? <Lock size={16} className="sidebar-lock-icon" /> : item.icon}
                    </span>
                    {isOpen && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ⭐ ACCOUNT SECTION (BOTTOM) */}
        <div className="sidebar-account-section">
          {isOpen && (
            <div className="account-info">
              <span className="account-name">{name}</span>
              <span className="account-email">{email}</span>
            </div>
          )}

          <ul className="sidebar-nav account-nav">
            <li>
              <NavLink
                to="/profile"
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""} ${!isOpen ? "mini" : ""}`}
                title={!isOpen ? "My Profile" : ""}
              >
                <span className="nav-icon"><UserIcon size={20} /></span>
                {isOpen && <span className="nav-label">My Profile</span>}
              </NavLink>
            </li>
            <li>
              <button className={`nav-link logout-btn ${!isOpen ? "mini" : ""}`} onClick={handleLogout} title={!isOpen ? "Logout" : ""}>
                <span className="nav-icon"><LogOut size={20} /></span>
                {isOpen && <span className="nav-label">Logout</span>}
              </button>
            </li>
          </ul>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

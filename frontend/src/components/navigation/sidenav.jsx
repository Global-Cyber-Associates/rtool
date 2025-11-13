import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import "./sidenav.css";

const Sidebar = ({ onToggle }) => {
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    { label: "Dashboard", path: "/" },
    { label: "Visualizer", path: "/visualizer" },
    { label: "Devices", path: "/devices" },
    { label: "Logs", path: "/logs" },
    { label: "Features", path: "/features" },
    { label: "Scanner", path: "/scan" },
    { label: "USB Control", path: "/usb" },
  ];

  useEffect(() => {
    // Notify parent when sidebar toggles
    if (onToggle) onToggle(isOpen);
  }, [isOpen, onToggle]);

  // Auto-close for small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsOpen(false);
      else setIsOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <h2 className="sidebar-title">Control Panel</h2>
        <ul className="sidebar-nav">
          {navItems.map((item, idx) => (
            <li key={idx}>
              <NavLink
                to={item.path}
                onClick={() => window.innerWidth < 768 && setIsOpen(false)}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                end
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
};

export default Sidebar;

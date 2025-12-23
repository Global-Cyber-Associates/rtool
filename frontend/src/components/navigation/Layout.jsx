import React, { useState, useEffect } from "react";
import Sidebar from "./sidenav";
import TopNav from "./topnav";
import "./layout.css";

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Handle responsive auto-close
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };

        handleResize(); // Set initial
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className={`app-layout ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
            <Sidebar onToggle={setIsSidebarOpen} isOpen={isSidebarOpen} />
            <div className="main-wrapper">
                <main className="content-container">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "../../utils/toast";
import logo from "../../assets/gca.png";
import "./login.css";

function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        companyName: "",
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await resp.json();

            if (resp.ok) {
                toast.success(data.message || "Registration request submitted successfully!");
                setFormData({ name: "", email: "", password: "", companyName: "" });
                setSuccess(true);
            } else {
                toast.error(data.message || "Registration failed");
            }
        } catch (err) {
            toast.error("Network error. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <img src={logo} alt="GCA Logo" className="login-logo" />
                <h2 className="login-title">VisuN</h2>
                <p className="login-subtitle">Client Registration Request</p>

                {!success ? (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                required
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                required
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Company/Tenant Name</label>
                            <input
                                type="text"
                                name="companyName"
                                value={formData.companyName}
                                required
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                required
                                onChange={handleChange}
                            />
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? "Submitting..." : "Submit Request"}
                        </button>
                    </form>
                ) : (
                    <div className="registration-success-message" style={{ textAlign: "center", padding: "20px" }}>
                        <div style={{ background: "rgba(30, 41, 59, 0.5)", color: "#1f8ef1", padding: "15px", borderRadius: "10px", marginBottom: "20px", border: "1px solid rgba(31, 142, 241, 0.3)" }}>
                            Request Submitted! Our technical team will review and provision your tenant shortly.
                        </div>
                    </div>
                )}

                <div style={{ marginTop: "20px", textAlign: "center" }}>
                    <p style={{ color: "#a8dadc", fontSize: "0.9rem" }}>
                        Already have an account? <Link to="/login" style={{ color: "#fff", fontWeight: "bold" }}>Login Here</Link>
                    </p>
                </div>
            </div>
            <div className="login-footer">© 2025 Global Cyber Associates</div>
        </div>
    );
}

export default Register;

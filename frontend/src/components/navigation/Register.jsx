import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "../../assets/gca.png";
import "./login.css"; // Reuse login styles

function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        companyName: "",
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await resp.json();

            if (resp.ok) {
                setSuccess(data.message);
                setFormData({ name: "", email: "", password: "", companyName: "" });
            } else {
                setError(data.message || "Registration failed");
            }
        } catch (err) {
            setError("Network error. Please try again.");
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

                {error && <div className="login-error">{error}</div>}
                {success && <div className="login-success" style={{ color: "#2ecc71", marginBottom: "15px", textAlign: "center", fontSize: "0.9rem" }}>{success}</div>}

                {!success && (
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

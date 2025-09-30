import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./UserDashboard.module.css";

function formatDate(dtStr) {
    if (!dtStr) return "-";
    try {
        return new Date(dtStr).toLocaleString();
    } catch {
        return dtStr;
    }
}

export default function UserDashboard() {
    const { user, logout, loading } = useAuth();
    const navigate = useNavigate();

    // Redirect to login if not authenticated

    useEffect(() => {
        if (!loading && !user) {
            navigate("/login");
        }
    }, [user, loading, navigate]);

    if (!user) return null; // render nothing while redirecting

    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";

    async function handleLogout() {
        try {
            await logout?.();
        } catch (err) {
            console.error("Logout failed", err);
        } finally {
            navigate("/login");
        }
    }

    async function copyUserId() {
        try {
            await navigator.clipboard.writeText(user._id || "");
            // replace with your toast if you have one
            alert("User ID copied to clipboard");
        } catch (err) {
            console.warn("copy failed", err);
        }
    }


    if (loading) return <p>Loading...</p>;
    if (!user) return null; // while redirecting

    return (
        <main className={styles.root}>
            <header className={styles.header}>
                <div className={styles.avatarWrap}>
                    {user.avatar ? (
                        <img className={styles.avatar} src={user.avatar} alt={user.firstName || "User"} />
                    ) : (
                        <div className={styles.avatarLetter}>{(user.firstName || "U")[0].toUpperCase()}</div>
                    )}
                </div>

                <div className={styles.titleWrap}>
                    <h1 className={styles.name}>{fullName}</h1>
                    <div className={styles.role}>{user.role ? user.role.toUpperCase() : "USER"}</div>
                </div>

                <div className={styles.actionsTop}>
                    <button className={styles.btn} onClick={() => navigate("/profile")}>Edit profile</button>
                    <button className={styles.btnOutline} onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <section className={styles.layout}>
                <div className={styles.card} aria-labelledby="profile-heading">
                    <h2 id="profile-heading" className={styles.cardTitle}>Profile</h2>

                    <dl className={styles.details}>
                        <div>
                            <dt>Email</dt>
                            <dd>{user.email || "-"}</dd>
                        </div>

                        <div>
                            <dt>Email verified</dt>
                            <dd>{user.isEmailVerified ? "Yes" : "No"}</dd>
                        </div>

                        <div>
                            <dt>Phone</dt>
                            <dd>{user.phone || "-"}</dd>
                        </div>

                        <div>
                            <dt>Phone verified</dt>
                            <dd>{user.isPhoneVerified ? "Yes" : "No"}</dd>
                        </div>
                    </dl>

                    <div className={styles.cardActions}>
                        <button className={styles.btn} onClick={() => navigate("/verify-phone")}>{user.isPhoneVerified ? "Phone verified" : "Verify phone"}</button>

                        <button className={styles.btn} onClick={() => navigate("/forgot-password")}>
                            Change / Reset password
                        </button>
                    </div>
                </div>

                <aside className={styles.card} aria-labelledby="subscription-heading">
                    <h2 id="subscription-heading" className={styles.cardTitle}>Subscription</h2>

                    <div className={styles.subGrid}>
                        <div>
                            <dt>Plan</dt>
                            <dd>{user.subscription?.plan || "Free / none"}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd>{user.subscription?.status || "inactive"}</dd>
                        </div>
                        <div>
                            <dt>Started</dt>
                            <dd>{formatDate(user.subscription?.createdAt)}</dd>
                        </div>
                        <div>
                            <dt>Updated</dt>
                            <dd>{formatDate(user.subscription?.updatedAt)}</dd>
                        </div>
                    </div>

                    <div className={styles.cardActions}>
                        <button className={styles.btn} onClick={() => navigate("/subscribe")}>Manage / Subscribe</button>
                        {user.subscription?.status === "active" ? (
                            <button className={styles.btnOutline} onClick={() => alert("Cancel flow not implemented")}>Cancel</button>
                        ) : null}
                    </div>

                    <div className={styles.tips}>
                        <strong>Tips</strong>
                        <ul>
                            <li>Verify your email & phone to get the best experience.</li>
                            <li>Click Manage to upgrade or start a subscription.</li>
                        </ul>
                    </div>
                </aside>
            </section>
        </main>
    );
}


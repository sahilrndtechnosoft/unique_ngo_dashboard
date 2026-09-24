import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AppDispatch } from '../../store';
import { setPageTitle } from '../../store/themeConfigSlice';
import { clearAuth, setCredentials, setPermissions } from '../../store/authSlice';
import { adminLogin, fetchMyPermissions } from '../../services/auth.service';
import { getErrorMessage } from '../../services/api';
import AuthLayout from '../../components/Auth/AuthLayout';
import PasswordInput from '../../components/Auth/PasswordInput';
import Icon from '../../components/Admin/WorkspaceIcon';

export default function LoginBoxed() {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const submitting = useRef(false);
    useEffect(() => { dispatch(setPageTitle('Sign in')); }, [dispatch]);

    const submitForm = async (event: FormEvent) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setError('');
        setLoading(true);
        let credentialsSet = false;
        try {
            const result = await adminLogin(email.trim(), password);
            dispatch(setCredentials(result));
            credentialsSet = true;
            const perms = await fetchMyPermissions();
            dispatch(setPermissions({ isSuperAdmin: perms.isSuperAdmin, permissions: (perms.permissions ?? []).map(p => p.key) }));
            const from = location.state?.from;
            const path = typeof from?.pathname === 'string' && from.pathname.startsWith('/') && !from.pathname.startsWith('//') && !from.pathname.startsWith('/auth/') ? from.pathname + (from.search || '') : '/';
            navigate(path, { replace: true });
        } catch (err) {
            if (credentialsSet) dispatch(clearAuth());
            setError(getErrorMessage(err, 'We couldn’t sign you in. Check your email and password, then try again.'));
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    };

    return <AuthLayout>
        <span className="auth-eyebrow">WELCOME BACK</span>
        <h2>Sign in to your workspace</h2>
        <p className="auth-description">Your community is doing good things.<br />Let’s keep them moving.</p>
        <form onSubmit={submitForm} aria-label="Sign in" aria-busy={loading}>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <div className="auth-field"><label htmlFor="login-email">Work email</label><input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@organization.org" disabled={loading} /></div>
            <div className="auth-field"><label htmlFor="login-password">Password</label><PasswordInput id="login-password" name="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" disabled={loading} /></div>
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}{!loading && <Icon name="arrow" />}</button>
        </form>
        <div className="auth-note"><Icon name="help" /><p>Having trouble signing in? Your workspace administrator can help with your account or password.</p></div>
    </AuthLayout>;
}

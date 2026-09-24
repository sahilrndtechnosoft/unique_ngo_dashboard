import { PropsWithChildren } from 'react';
import { useAppBranding } from '../../hooks/useAppBranding';
import { mediaUrl } from '../../services/api';
import Icon from '../Admin/WorkspaceIcon';
import '../../assets/css/auth.css';

export default function AuthLayout({ children }: PropsWithChildren) {
    const branding = useAppBranding();
    return (
        <main className="auth-workspace">
            <aside className="auth-story">
                <div className="auth-brand">
                    <img src={branding.logoUrl ? mediaUrl(branding.logoUrl) : '/assets/images/logo.svg'} alt={branding.companyName || 'Unique NGO'} />
                    <span>{branding.companyName || 'Unique NGO'}<small>Operations workspace</small></span>
                </div>
                <div className="auth-story-content">
                    <span className="auth-eyebrow">CONNECTED BY PURPOSE</span>
                    <h1>Good work.<br />Greater together.</h1>
                    <p>One workspace for the people, partnerships, and everyday actions that make a difference.</p>
                    <div className="auth-pillars">
                        <div><Icon name="heart" /><span>Coordinate your community<small>Donations, campaigns, and care.</small></span></div>
                        <div><Icon name="box" /><span>Keep operations moving<small>Orders, products, and partnerships.</small></span></div>
                        <div><Icon name="users" /><span>Bring your team together<small>The right access for every role.</small></span></div>
                    </div>
                </div>
                <p className="auth-story-footer">Every action makes a difference.</p>
            </aside>
            <section className="auth-main">
                <div className="auth-mobile-brand"><img src={branding.logoUrl ? mediaUrl(branding.logoUrl) : '/assets/images/logo.svg'} alt={branding.companyName || 'Unique NGO'} /></div>
                <div className="auth-form-container">{children}</div>
                <footer>© {new Date().getFullYear()} {branding.companyName || 'Unique NGO'} <span>Admin workspace</span></footer>
            </section>
        </main>
    );
}

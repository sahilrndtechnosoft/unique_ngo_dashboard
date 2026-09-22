import { isRouteErrorResponse, Link, useNavigate, useRouteError } from 'react-router-dom';
import IconHome from './Icon/IconHome';
import IconRefresh from './Icon/IconRefresh';

export default function RouteError() {
    const error = useRouteError();
    const navigate = useNavigate();
    const title = isRouteErrorResponse(error) && error.status === 404
        ? 'Page not found'
        : 'This page could not load';

    return (
        <main className="route-error" role="alert">
            <div className="route-error-mark">!</div>
            <p className="route-error-eyebrow">Something went wrong</p>
            <h1>{title}</h1>
            <p className="route-error-copy">Your other workspace pages are still available. Try loading this page again or return to the dashboard.</p>
            <div className="route-error-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate(0)}>
                    <IconRefresh className="h-4 w-4" />
                    Try again
                </button>
                <Link to="/" className="btn btn-outline-dark">
                    <IconHome className="h-4 w-4" />
                    Dashboard
                </Link>
            </div>
        </main>
    );
}

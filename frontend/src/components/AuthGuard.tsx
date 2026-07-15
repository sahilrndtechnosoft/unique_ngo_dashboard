import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { IRootState } from '../store';
import { PropsWithChildren } from 'react';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export default function AuthGuard({ children }: PropsWithChildren) {
    const { accessToken, user } = useSelector((state: IRootState) => state.auth);
    const location = useLocation();

    if (!accessToken || !user) {
        return <Navigate to="/auth/boxed-signin" replace state={{ from: location }} />;
    }

    if (!ADMIN_ROLES.includes(user.role)) {
        return <Navigate to="/auth/boxed-signin" replace />;
    }

    return <>{children}</>;
}

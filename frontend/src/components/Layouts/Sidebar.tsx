import PerfectScrollbar from 'react-perfect-scrollbar';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import { clearAuth } from '../../store/authSlice';
import { IRootState } from '../../store';
import { useEffect } from 'react';
import IconCaretsDown from '../Icon/IconCaretsDown';
import IconMinus from '../Icon/IconMinus';
import IconMenuDashboard from '../Icon/Menu/IconMenuDashboard';
import IconMenuUsers from '../Icon/Menu/IconMenuUsers';
import IconMenuForms from '../Icon/Menu/IconMenuForms';
import IconMenuTables from '../Icon/Menu/IconMenuTables';
import IconMenuDatatables from '../Icon/Menu/IconMenuDatatables';
import IconMenuPages from '../Icon/Menu/IconMenuPages';
import IconMenuAuthentication from '../Icon/Menu/IconMenuAuthentication';
import { adminMenuItems, canAccess } from '../../config/admin-menu';
import { logout } from '../../services/auth.service';
import { mediaUrl } from '../../services/api';

const menuIcons: Record<string, JSX.Element> = {
    '/': <IconMenuDashboard className="group-hover:!text-primary shrink-0" />,
    '/admin/users': <IconMenuUsers className="group-hover:!text-primary shrink-0" />,
    '/admin/sellers': <IconMenuUsers className="group-hover:!text-primary shrink-0" />,
    '/admin/categories': <IconMenuTables className="group-hover:!text-primary shrink-0" />,
    '/admin/products': <IconMenuDatatables className="group-hover:!text-primary shrink-0" />,
    '/admin/roles': <IconMenuForms className="group-hover:!text-primary shrink-0" />,
    '/admin/settings': <IconMenuPages className="group-hover:!text-primary shrink-0" />,
};

const Sidebar = () => {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const { permissions, isSuperAdmin, refreshToken, user } = useSelector((state: IRootState) => state.auth);
    const branding = useSelector((state: IRootState) => state.settings);
    const location = useLocation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const logoSrc = branding.logoUrl ? mediaUrl(branding.logoUrl) : '/assets/images/logo.svg';
    const brandName = branding.companyName || 'Unique NGO';

    useEffect(() => {
        if (window.innerWidth < 1024 && themeConfig.sidebar) {
            dispatch(toggleSidebar());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    const visibleItems = adminMenuItems.filter((item) => canAccess(isSuperAdmin, permissions, item.permission));

    const handleLogout = async () => {
        try {
            if (refreshToken) await logout(refreshToken);
        } catch {
            // ignore logout API errors
        }
        dispatch(clearAuth());
        navigate('/auth/boxed-signin');
    };

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed min-h-screen h-full top-0 bottom-0 w-[260px] shadow-[5px_0_25px_0_rgba(94,92,154,0.1)] z-50 transition-all duration-300 ${semidark ? 'text-white-dark' : ''}`}
            >
                <div className="bg-white dark:bg-black h-full">
                    <div className="flex justify-between items-center px-3 py-4 gap-2">
                        <NavLink to="/" className="main-logo flex items-center shrink-0 min-w-0 gap-2.5">
                            <img className="w-11 h-11 flex-none object-contain rounded" src={logoSrc} alt={brandName} />
                            <span className="text-lg font-semibold align-middle dark:text-white-light truncate">{brandName}</span>
                        </NavLink>
                        <button
                            type="button"
                            className="collapse-icon w-8 h-8 shrink-0 rounded-full flex items-center hover:bg-gray-500/10 dark:hover:bg-dark-light/10 dark:text-white-light transition duration-300 rtl:rotate-180"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>
                    <PerfectScrollbar className="h-[calc(100vh-80px)] relative">
                        <ul className="relative font-semibold space-y-0.5 p-4 py-0">
                            <h2 className="py-3 px-7 flex items-center uppercase font-extrabold bg-white-light/30 dark:bg-dark dark:bg-opacity-[0.08] -mx-4 mb-1">
                                <IconMinus className="w-4 h-5 flex-none hidden" />
                                <span>Admin</span>
                            </h2>
                            {visibleItems.map((item) => (
                                <li className="nav-item" key={item.to}>
                                    <NavLink to={item.to} end={item.to === '/'} className="group">
                                        <div className="flex items-center">
                                            {menuIcons[item.to] ?? <IconMenuDashboard className="group-hover:!text-primary shrink-0" />}
                                            <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">{item.label}</span>
                                        </div>
                                    </NavLink>
                                </li>
                            ))}
                            <li className="nav-item mt-4">
                                <button type="button" className="group w-full text-left" onClick={handleLogout}>
                                    <div className="flex items-center">
                                        <IconMenuAuthentication className="group-hover:!text-primary shrink-0" />
                                        <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">
                                            Logout{user?.fullName ? ` (${user.fullName})` : ''}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;

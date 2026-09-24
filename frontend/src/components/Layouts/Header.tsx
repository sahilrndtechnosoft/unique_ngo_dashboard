import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { IRootState } from '../../store';
import { toggleRTL, toggleTheme, toggleSidebar } from '../../store/themeConfigSlice';
import { clearAuth } from '../../store/authSlice';
import i18next from 'i18next';
import Dropdown from '../Dropdown';
import IconMenu from '../Icon/IconMenu';
import IconSun from '../Icon/IconSun';
import IconMoon from '../Icon/IconMoon';
import IconLaptop from '../Icon/IconLaptop';
import IconUser from '../Icon/IconUser';
import IconLogout from '../Icon/IconLogout';
import IconCaretDown from '../Icon/IconCaretDown';
import { mediaUrl } from '../../services/api';
import { logout } from '../../services/auth.service';
import IconSearch from '../Icon/IconSearch';
import { adminMenuGroups, canAccess } from '../../config/admin-menu';

const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const pageTitle = themeConfig.pageTitle || 'Dashboard';
    const isRtl = themeConfig.rtlClass === 'rtl';
    const { user, refreshToken, permissions, isSuperAdmin } = useSelector((state: IRootState) => state.auth);
    const branding = useSelector((state: IRootState) => state.settings);
    const logoSrc = branding.logoUrl ? mediaUrl(branding.logoUrl) : '/assets/images/logo.svg';
    const brandName = branding.companyName || 'Unique NGO';
    const [flag, setFlag] = useState(themeConfig.locale);
    const [quickSearch, setQuickSearch] = useState('');
    const [quickSearchOpen, setQuickSearchOpen] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 1023px)').matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 1023px)');
        const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
        syncViewport();
        mediaQuery.addEventListener('change', syncViewport);
        return () => mediaQuery.removeEventListener('change', syncViewport);
    }, []);

    useEffect(() => {
        const selector = document.querySelector('ul.horizontal-menu a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
        }
    }, [location]);

    useEffect(() => {
        document.title = `${pageTitle} | Unique NGO Dashboard`;
    }, [pageTitle]);

    useEffect(() => {
        const onShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                document.getElementById('workspace-quick-search')?.focus();
                setQuickSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onShortcut);
        return () => window.removeEventListener('keydown', onShortcut);
    }, []);

    const setLocale = (nextFlag: string) => {
        setFlag(nextFlag);
        dispatch(toggleRTL(nextFlag.toLowerCase() === 'ae' ? 'rtl' : 'ltr'));
    };

    const quickLinks = useMemo(
        () => adminMenuGroups.flatMap((group) => group.items.filter((item) => canAccess(isSuperAdmin, permissions, item.permission))),
        [isSuperAdmin, permissions],
    );
    const quickMatches = quickLinks
        .filter((item) => `${item.label} ${item.to}`.toLowerCase().includes(quickSearch.trim().toLowerCase()))
        .slice(0, 6);
    const goToQuickMatch = (to: string) => {
        navigate(to);
        setQuickSearch('');
        setQuickSearchOpen(false);
    };

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
        <header className={`app-topbar z-40 ${themeConfig.semidark && themeConfig.menu === 'horizontal' ? 'dark' : ''}`}>
            <div className="shadow-sm">
                <div className="relative bg-white flex w-full items-center px-5 py-2.5 dark:bg-black">
                    <div className="horizontal-logo flex lg:hidden items-center ltr:mr-2 rtl:ml-2">
                        <Link to="/" className="main-logo flex items-center shrink-0 gap-2">
                            <img className="w-9 h-9 object-contain" src={logoSrc} alt={brandName} />
                            <span className="text-xl font-semibold align-middle hidden md:inline dark:text-white-light">{brandName}</span>
                        </Link>
                    </div>

                    <button
                        type="button"
                        aria-label={isMobileViewport ? 'Open navigation' : 'Toggle navigation sidebar'}
                        title={isMobileViewport ? 'Open navigation' : 'Toggle navigation sidebar'}
                        aria-expanded={isMobileViewport ? themeConfig.sidebar : !themeConfig.sidebar}
                        aria-controls="primary-navigation"
                        className="collapse-icon flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:bg-white-light/90 dark:hover:bg-dark/60 dark:text-[#d0d2d6] hover:text-primary ltr:ml-2 rtl:mr-2"
                        onClick={() => dispatch(toggleSidebar())}
                    >
                        <IconMenu className="w-5 h-5" />
                    </button>

                    <div className="page-context min-w-0 ltr:ml-2 sm:ltr:ml-4 rtl:mr-2 sm:rtl:mr-4">
                        <nav aria-label="Breadcrumb">
                            <ol className="flex min-w-0 items-center gap-2 text-xs">
                                <li><Link to="/" className="workspace-crumb-home">Workspace</Link></li>
                                <li aria-hidden="true" className="workspace-crumb-divider">/</li>
                                <li className="workspace-crumb-current truncate" aria-current="page" aria-live="polite">{pageTitle}</li>
                            </ol>
                        </nav>
                    </div>

                    <div className="workspace-global-search relative hidden lg:block ltr:ml-8 rtl:mr-8">
                        <form
                            role="search"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (quickMatches[0]) goToQuickMatch(quickMatches[0].to);
                            }}
                        >
                            <label className="sr-only" htmlFor="workspace-quick-search">Jump to a page</label>
                            <IconSearch className="pointer-events-none absolute top-1/2 ltr:left-3 rtl:right-3 h-4 w-4 -translate-y-1/2 text-white-dark" />
                            <input
                                id="workspace-quick-search"
                                className="workspace-quick-search-input form-input w-[min(28vw,280px)] ltr:pl-9 rtl:pr-9"
                                placeholder="Jump to a page"
                                value={quickSearch}
                                onFocus={() => setQuickSearchOpen(true)}
                                onBlur={() => setQuickSearchOpen(false)}
                                onChange={(event) => {
                                    setQuickSearch(event.target.value);
                                    setQuickSearchOpen(true);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        setQuickSearchOpen(false);
                                        event.currentTarget.blur();
                                    }
                                }}
                                aria-expanded={quickSearchOpen && Boolean(quickSearch.trim())}
                                aria-controls="workspace-quick-search-results"
                            />
                        </form>
                        {quickSearchOpen && quickSearch.trim() ? (
                            <div id="workspace-quick-search-results" className="workspace-quick-search-results absolute top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-lg border bg-white shadow-lg dark:bg-[#151f30]" role="listbox">
                                {quickMatches.length ? quickMatches.map((item) => (
                                    <button
                                        key={item.to}
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-primary/10 hover:text-primary"
                                        role="option"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => goToQuickMatch(item.to)}
                                    >
                                        <span>{item.label}</span>
                                        <span className="text-xs text-white-dark">{item.to}</span>
                                    </button>
                                )) : <p className="px-3 py-3 text-sm text-white-dark">No matching page</p>}
                            </div>
                        ) : null}
                    </div>

                    <div className="ltr:ml-auto rtl:mr-auto flex items-center space-x-1.5 lg:space-x-2 rtl:space-x-reverse dark:text-[#d0d2d6]">
                        <div>
                            {themeConfig.theme === 'light' ? (
                                    <button
                                        type="button"
                                        aria-label={themeConfig.theme === 'light' ? 'Switch to dark theme' : 'Use system theme'}
                                        title={themeConfig.theme === 'light' ? 'Switch to dark theme' : 'Use system theme'}
                                    className="flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('dark'))}
                                >
                                    <IconSun />
                                </button>
                            ) : themeConfig.theme === 'dark' ? (
                                <button
                                    type="button"
                                    aria-label="Use system theme"
                                    title="Use system theme"
                                    className="flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('system'))}
                                >
                                    <IconMoon />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    aria-label="Switch to light theme"
                                    title="Switch to light theme"
                                    className="flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('light'))}
                                >
                                    <IconLaptop />
                                </button>
                            )}
                        </div>

                        <div className="dropdown shrink-0">
                            <Dropdown
                                offset={[0, 8]}
                                placement={`${isRtl ? 'bottom-start' : 'bottom-end'}`}
                                btnClassName="relative group block"
                                button={
                                    <span className="flex items-center gap-2 rounded-full bg-white-light/40 dark:bg-dark/40 px-2 py-1.5 hover:bg-white-light/90 dark:hover:bg-dark/60">
                                        <img
                                            className="w-8 h-8 rounded-full object-cover"
                                            src={user?.profilePicture ? mediaUrl(user.profilePicture) : '/assets/images/auth/user.png'}
                                            alt="user"
                                            onError={(event) => {
                                                event.currentTarget.onerror = null;
                                                event.currentTarget.src = '/assets/images/auth/user.png';
                                            }}
                                        />
                                        <span className="hidden md:inline font-semibold dark:text-white-light">{user?.fullName || 'Admin'}</span>
                                        <IconCaretDown className="w-4 h-4" />
                                    </span>
                                }
                            >
                                <ul className="text-dark dark:text-white-dark !py-0 w-[230px] font-semibold dark:text-white-light/90">
                                    <li>
                                        <div className="flex items-center px-4 py-4">
                                            <img
                                                className="rounded-md w-10 h-10 object-cover"
                                                src={user?.profilePicture ? mediaUrl(user.profilePicture) : '/assets/images/auth/user.png'}
                                                alt="user"
                                                onError={(event) => {
                                                    event.currentTarget.onerror = null;
                                                    event.currentTarget.src = '/assets/images/auth/user.png';
                                                }}
                                            />
                                            <div className="ltr:pl-4 rtl:pr-4 truncate">
                                                <h4 className="text-base">{user?.fullName || 'Admin'}</h4>
                                                <span className="text-black/60 dark:text-dark-light/60 text-xs">
                                                    {user?.email}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                    <li>
                                        <Link to="/users/profile" className="dark:hover:text-white">
                                            <IconUser className="w-4.5 h-4.5 ltr:mr-2 rtl:ml-2 shrink-0" />
                                            Profile
                                        </Link>
                                    </li>
                                    <li className="border-t border-white-light dark:border-white-light/10">
                                        <button type="button" className="text-danger !py-3 w-full" onClick={handleLogout}>
                                            <IconLogout className="w-4.5 h-4.5 ltr:mr-2 rtl:ml-2 rotate-90 shrink-0" />
                                            Sign Out
                                        </button>
                                    </li>
                                </ul>
                            </Dropdown>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;

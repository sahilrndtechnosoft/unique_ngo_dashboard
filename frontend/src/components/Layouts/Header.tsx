import { useEffect, useState } from 'react';
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

const Header = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const isRtl = themeConfig.rtlClass === 'rtl';
    const { user, refreshToken } = useSelector((state: IRootState) => state.auth);
    const branding = useSelector((state: IRootState) => state.settings);
    const logoSrc = branding.logoUrl ? mediaUrl(branding.logoUrl) : '/assets/images/logo.svg';
    const brandName = branding.companyName || 'Unique NGO';
    const [flag, setFlag] = useState(themeConfig.locale);

    useEffect(() => {
        const selector = document.querySelector('ul.horizontal-menu a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
        }
    }, [location]);

    const setLocale = (nextFlag: string) => {
        setFlag(nextFlag);
        dispatch(toggleRTL(nextFlag.toLowerCase() === 'ae' ? 'rtl' : 'ltr'));
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
        <header className={`z-40 ${themeConfig.semidark && themeConfig.menu === 'horizontal' ? 'dark' : ''}`}>
            <div className="shadow-sm">
                <div className="relative bg-white flex w-full items-center px-5 py-2.5 dark:bg-black">
                    <div className="horizontal-logo flex lg:hidden justify-between items-center ltr:mr-2 rtl:ml-2">
                        <Link to="/" className="main-logo flex items-center shrink-0 gap-2">
                            <img className="w-9 h-9 object-contain" src={logoSrc} alt={brandName} />
                            <span className="text-xl font-semibold align-middle hidden md:inline dark:text-white-light">{brandName}</span>
                        </Link>
                        <button
                            type="button"
                            className="collapse-icon flex-none dark:text-[#d0d2d6] hover:text-primary flex lg:hidden ltr:ml-2 rtl:mr-2 p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:bg-white-light/90 dark:hover:bg-dark/60"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconMenu className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="hidden lg:flex items-center">
                        <button
                            type="button"
                            className="collapse-icon flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:bg-white-light/90 dark:hover:bg-dark/60 dark:text-[#d0d2d6] hover:text-primary"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconMenu className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="ltr:ml-auto rtl:mr-auto flex items-center space-x-1.5 lg:space-x-2 rtl:space-x-reverse dark:text-[#d0d2d6]">
                        <div>
                            {themeConfig.theme === 'light' ? (
                                <button
                                    className="flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('dark'))}
                                >
                                    <IconSun />
                                </button>
                            ) : themeConfig.theme === 'dark' ? (
                                <button
                                    className="flex items-center p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60"
                                    onClick={() => dispatch(toggleTheme('system'))}
                                >
                                    <IconMoon />
                                </button>
                            ) : (
                                <button
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
                                btnClassName="block p-2 rounded-full bg-white-light/40 dark:bg-dark/40 hover:text-primary hover:bg-white-light/90 dark:hover:bg-dark/60"
                                button={<img className="w-5 h-5 object-cover rounded-full" src={`/assets/images/flags/${flag.toUpperCase()}.svg`} alt="flag" />}
                            >
                                <ul className="!px-2 text-dark dark:text-white-dark grid grid-cols-2 gap-2 font-semibold dark:text-white-light/90 w-[280px]">
                                    {themeConfig.languageList.map((item: any) => (
                                        <li key={item.code}>
                                            <button
                                                type="button"
                                                className={`flex w-full hover:text-primary rounded-lg ${flag === item.code ? 'bg-primary/10 text-primary' : ''}`}
                                                onClick={() => {
                                                    i18next.changeLanguage(item.code);
                                                    setLocale(item.code);
                                                }}
                                            >
                                                <img src={`/assets/images/flags/${item.code.toUpperCase()}.svg`} alt="flag" className="w-5 h-5 object-cover rounded-full" />
                                                <span className="ltr:ml-3 rtl:mr-3">{item.name}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </Dropdown>
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
                                            src={user?.profilePicture ? mediaUrl(user.profilePicture) : '/assets/images/user-profile.jpeg'}
                                            alt="user"
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
                                                src={user?.profilePicture ? mediaUrl(user.profilePicture) : '/assets/images/user-profile.jpeg'}
                                                alt="user"
                                            />
                                            <div className="ltr:pl-4 rtl:pr-4 truncate">
                                                <h4 className="text-base">{user?.fullName || 'Admin'}</h4>
                                                <button type="button" className="text-black/60 dark:text-dark-light/60 text-xs">
                                                    {user?.email}
                                                </button>
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

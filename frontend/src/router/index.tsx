import { createBrowserRouter } from 'react-router-dom';
import BlankLayout from '../components/Layouts/BlankLayout';
import DefaultLayout from '../components/Layouts/DefaultLayout';
import AuthGuard from '../components/AuthGuard';
import { routes } from './routes';

const finalRoutes = routes.map((route) => {
    const content =
        route.layout === 'blank' ? (
            <BlankLayout>{route.element}</BlankLayout>
        ) : (
            <AuthGuard>
                <DefaultLayout>{route.element}</DefaultLayout>
            </AuthGuard>
        );

    return {
        ...route,
        element: content,
    };
});

const router = createBrowserRouter(finalRoutes);

export default router;

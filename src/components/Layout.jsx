import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Grid3X3, Brain, Code2 } from 'lucide-react';

export default function Layout() {
  const location = useLocation();

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-500/20 text-blue-400'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
    }`;

  const bottomTabClass = (path) => {
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    return `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-blue-400' : 'text-gray-500'
    }`;
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-16 md:pb-0 overflow-x-hidden max-w-full">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-blue-500/20">
                <Code2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
              </div>
              <span className="hidden sm:inline text-lg font-bold text-white">DSA Prep Studio</span>
            </NavLink>

            <div className="hidden md:flex items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink to="/patterns" className={linkClass}>
                <Grid3X3 className="h-4 w-4" />
                Patterns
              </NavLink>
              <NavLink to="/anki" className={linkClass}>
                <Brain className="h-4 w-4" />
                Anki Review
              </NavLink>
            </div>

            {/* Compact nav for tablet (sm to md) */}
            <div className="flex md:hidden items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </NavLink>
              <NavLink to="/patterns" className={linkClass}>
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Patterns</span>
              </NavLink>
              <NavLink to="/anki" className={linkClass}>
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Anki</span>
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <Outlet />
      </main>

      {/* Bottom Tab Bar - mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl md:hidden">
        <NavLink to="/" end className={bottomTabClass('/')}>
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/patterns" className={bottomTabClass('/patterns')}>
          <Grid3X3 className="h-5 w-5" />
          <span>Patterns</span>
        </NavLink>
        <NavLink to="/anki" className={bottomTabClass('/anki')}>
          <Brain className="h-5 w-5" />
          <span>Review</span>
        </NavLink>
      </div>
    </div>
  );
}

import { Home, Compass, Settings, User, Bookmark } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { clsx } from "clsx";

export function Sidebar() {
    const location = useLocation();

    const navItems = [
        { icon: Home, label: "Dashboard", path: "/" },
        { icon: Compass, label: "Discover", path: "/discover" },
        { icon: Bookmark, label: "Saved", path: "/saved" },
        { icon: User, label: "Identity", path: "/identity" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ];

    return (
        <div className="w-20 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 gap-6 fixed left-0 top-0 z-50">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
                <span className="text-xl font-bold flex text-white">P</span>
            </div>

            <nav className="flex flex-col gap-4 w-full px-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200 group text-xs",
                                isActive
                                    ? "bg-zinc-800 text-indigo-400"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                            )}
                        >
                            <item.icon
                                strokeWidth={isActive ? 2.5 : 2}
                                className={clsx("w-6 h-6", isActive && "drop-shadow-md")}
                            />
                            <span className="opacity-0 group-hover:opacity-100 absolute left-16 bg-zinc-800 px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none transition-opacity">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

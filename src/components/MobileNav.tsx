import { Home, Compass, Settings, User, Bookmark } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { clsx } from "clsx";

export function MobileNav() {
    const location = useLocation();

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Compass, label: "Discover", path: "/discover" },
        { icon: Bookmark, label: "Saved", path: "/saved" },
        { icon: User, label: "Identity", path: "/identity" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden">
            <nav className="flex items-center justify-around h-16 px-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "flex flex-col items-center justify-center w-full h-full gap-1 active:scale-95 transition-transform",
                                isActive ? "text-indigo-400" : "text-zinc-500"
                            )}
                        >
                            <item.icon
                                strokeWidth={isActive ? 2.5 : 2}
                                className={clsx("w-6 h-6", isActive && "drop-shadow-[0_0_8px_rgba(129,140,248,0.3)]")}
                            />
                            <span className="text-[10px] font-medium tracking-tight">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

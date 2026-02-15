import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "../components/MobileNav";

export function AppLayout() {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="hidden md:block">
                <Sidebar />
            </div>

            <main className="flex-1 md:ml-20 p-4 md:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 min-h-screen">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>

            <MobileNav />
        </div>
    );
}

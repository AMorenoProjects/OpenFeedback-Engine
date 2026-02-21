import Link from "next/link";
import { LayoutDashboard, MessageSquare, Settings, Users, LogOut } from "lucide-react";

export function Sidebar() {
    return (
        <div className="w-64 border-r border-[#27272a] bg-[#18181b] flex flex-col h-full">
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b border-[#27272a]">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-white text-lg">MySaaS</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                    <LayoutDashboard className="w-5 h-5" />
                    <span className="text-sm font-medium">Dashboard</span>
                </Link>
                <Link
                    href="/users"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-medium">Customers</span>
                </Link>

                <div className="pt-4 pb-2">
                    <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Growth
                    </p>
                </div>

                <Link
                    href="/feedback"
                    className="flex items-center gap-3 px-3 py-2 rounded-md bg-indigo-500/10 text-indigo-400 font-medium"
                >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-sm">Feedback & Roadmap</span>
                </Link>
            </nav>

            {/* Footer Navigation */}
            <div className="p-4 border-t border-[#27272a] space-y-1">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                    <Settings className="w-5 h-5" />
                    <span className="text-sm font-medium">Settings</span>
                </Link>
                <button
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Log out</span>
                </button>
            </div>
        </div>
    );
}

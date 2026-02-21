import {
    Home,
    Box,
    Settings,
    MessageSquare,
    BarChart,
    Users,
    Zap
} from "lucide-react";

export function Sidebar() {
    return (
        <aside className="w-64 border-r border-white/5 bg-[#09090b]/80 backdrop-blur-xl flex flex-col h-full">
            <div className="h-16 flex items-center px-6 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="font-semibold text-white tracking-tight">Acme Stack</span>
                </div>
            </div>

            <div className="flex-1 py-6 px-4 space-y-8 overflow-y-auto">
                <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
                        Overview
                    </h3>
                    <nav className="space-y-1">
                        <a href="#" className="flex items-center gap-3 px-2 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                            <Home className="w-4 h-4" />
                            Dashboard
                        </a>
                        <a href="#" className="flex items-center gap-3 px-2 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                            <BarChart className="w-4 h-4" />
                            Analytics
                        </a>
                    </nav>
                </div>

                <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
                        Workspace
                    </h3>
                    <nav className="space-y-1">
                        <a href="#" className="flex items-center gap-3 px-2 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                            <Box className="w-4 h-4" />
                            Deployments
                        </a>
                        <a href="#" className="flex items-center gap-3 px-2 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                            <Users className="w-4 h-4" />
                            Team
                        </a>
                        <a href="#" className="flex items-center gap-3 px-2 py-2 text-sm bg-indigo-500/10 text-indigo-400 rounded-md transition-colors">
                            <MessageSquare className="w-4 h-4" />
                            Feedback
                        </a>
                    </nav>
                </div>
            </div>

            <div className="p-4 border-t border-white/5">
                <a href="#" className="flex items-center gap-3 px-2 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                    <Settings className="w-4 h-4" />
                    Project Settings
                </a>
            </div>
        </aside>
    );
}

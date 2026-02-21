import { Search, Bell, ChevronRight } from "lucide-react";

export function Header() {
    return (
        <header className="h-16 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-10 w-full">
            <div className="flex items-center text-sm text-zinc-400">
                <span className="hover:text-white cursor-pointer transition-colors">Acme Org</span>
                <ChevronRight className="w-4 h-4 mx-2 text-zinc-600" />
                <span className="hover:text-white cursor-pointer transition-colors">Acme Stack</span>
                <ChevronRight className="w-4 h-4 mx-2 text-zinc-600" />
                <span className="text-white font-medium">Feedback Queue</span>
            </div>

            <div className="flex items-center gap-6">
                <div className="relative group">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search feedback..."
                        className="w-64 bg-white/5 border border-white/10 rounded-md pl-9 pr-4 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                </div>

                <button className="relative text-zinc-400 hover:text-white transition-colors">
                    <Bell className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full"></span>
                </button>

                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/10"></div>
            </div>
        </header>
    );
}

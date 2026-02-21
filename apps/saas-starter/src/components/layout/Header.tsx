import { Bell, Search } from "lucide-react";

export function Header() {
    return (
        <header className="h-16 border-b border-[#27272a] bg-[#0f1115]/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-64 hidden sm:block">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full bg-[#18181b] border border-[#27272a] rounded-md pl-9 pr-4 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="text-zinc-400 hover:text-white relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full border border-[#0f1115]"></span>
                </button>

                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-medium text-white shadow-md">
                    JD
                </div>
            </div>
        </header>
    );
}

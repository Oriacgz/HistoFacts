import { Sparkles, Clock, Flame, Search } from 'lucide-react';

export default function FeedFilter({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}) {
  const tabs = [
    { id: 'latest', label: 'Latest Chronicles', icon: Clock },
    { id: 'popular', label: 'Trending Debates', icon: Flame },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-histo-paper/50 p-2 rounded-xl border border-histo-dark/10">
      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-ui font-semibold transition-all ${
                isActive
                  ? 'bg-white text-histo-dark shadow-xs border border-histo-dark/10'
                  : 'text-histo-ink/60 hover:text-histo-dark hover:bg-white/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-histo-copper' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-histo-ink/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter chronicles..."
          className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-white border border-histo-dark/15 rounded-lg text-xs font-ui outline-none focus:border-histo-copper transition-all"
        />
      </div>
    </div>
  );
}

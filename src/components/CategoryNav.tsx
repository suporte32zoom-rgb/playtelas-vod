import React from 'react';
import {
  Tv,
  Trophy,
  Film,
  Sparkles,
  Radio,
  Newspaper,
  Clapperboard,
  Tractor,
  HeartHandshake,
  MapPin,
  Star
} from 'lucide-react';
import { CategoryId } from '../types/tv';
import { CATEGORIES } from '../data/categories';

interface CategoryNavProps {
  activeCategory: CategoryId;
  onSelectCategory: (cat: CategoryId) => void;
  activeSubcategory: string;
  onSelectSubcategory: (sub: string) => void;
  favoritesCount: number;
  channelCounts: Record<string, number>;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Tv,
  Trophy,
  Film,
  Sparkles,
  Radio,
  Newspaper,
  Clapperboard,
  Tractor,
  HeartHandshake,
  MapPin,
  Star
};

export const CategoryNav: React.FC<CategoryNavProps> = ({
  activeCategory,
  onSelectCategory,
  activeSubcategory,
  onSelectSubcategory,
  favoritesCount,
  channelCounts
}) => {
  const currentCategoryInfo = CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="w-full flex flex-col gap-2 my-2">
      {/* Primary Category Horizontal Scrollable Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        {CATEGORIES.map((cat) => {
          const Icon = ICON_MAP[cat.iconName] || Tv;
          const isSelected = activeCategory === cat.id;
          const count = cat.id === 'favoritos' ? favoritesCount : channelCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.id);
                onSelectSubcategory('Todos');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border active:scale-95 shrink-0 ${
                isSelected
                  ? `bg-gradient-to-r ${cat.gradient} text-white border-white/20 shadow-lg shadow-indigo-900/30 scale-102`
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Subcategory Pills Bar (if active category has subcategories) */}
      {currentCategoryInfo && currentCategoryInfo.subcategories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pl-1">
          {currentCategoryInfo.subcategories.map((sub) => {
            const isSubSelected = activeSubcategory === sub;
            return (
              <button
                key={sub}
                onClick={() => onSelectSubcategory(sub)}
                className={`px-3 py-1 rounded-xl font-medium transition cursor-pointer text-xs whitespace-nowrap active:scale-95 ${
                  isSubSelected
                    ? 'bg-slate-800 text-indigo-400 border border-indigo-500/40 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

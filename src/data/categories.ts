import { CategoryInfo, CategoryId } from '../types/tv';

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'todos',
    label: 'Todos os Canais',
    iconName: 'Tv',
    description: 'Catálogo atualizado com 133 canais ao vivo',
    color: '#6366f1',
    gradient: 'from-indigo-600 to-violet-600',
    subcategories: ['Todos', 'Mais Assistidos', 'Em Alta', 'Full HD']
  },
  {
    id: 'esportes',
    label: 'Esportes',
    iconName: 'Trophy',
    description: 'Futebol ao vivo, lutas, debates e os maiores campeonatos',
    color: '#10b981',
    gradient: 'from-emerald-600 to-teal-700',
    subcategories: ['Todos', 'Futebol & Variedades', 'Grandes Ligas & Ao Vivo', 'Lutas & Artes Marciais', 'Pesca & Aventura']
  },
  {
    id: 'filmes-series',
    label: 'Filmes & Séries',
    iconName: 'Film',
    description: 'Estreias de cinema, clássicos, maratonas e suspense',
    color: '#f43f5e',
    gradient: 'from-rose-600 to-red-700',
    subcategories: ['Todos', 'Cinema & Filmes', 'Super Estreias', 'Ação & Adrenalina', 'Comédia & Família', 'Drama & Romance', 'Cult & Clássicos']
  },
  {
    id: 'infantil',
    label: 'Infantil',
    iconName: 'Sparkles',
    description: 'Desenhos animados, educativas e diversão segura para crianças',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-600',
    subcategories: ['Todos', 'Desenhos & Animação', 'Pré-Escolar & Educativo', 'Clássicos da Infância']
  },
  {
    id: 'tv-ao-vivo',
    label: 'TV Aberta & Redes',
    iconName: 'Radio',
    description: 'Principais emissoras abertas nacionais e programação pública',
    color: '#3b82f6',
    gradient: 'from-blue-600 to-indigo-700',
    subcategories: ['Todos', 'Rede Nacional Aberta', 'Cultura & Educação', 'Canais Legislativos & Públicos']
  },
  {
    id: 'noticias',
    label: 'Notícias & Hard News',
    iconName: 'Newspaper',
    description: 'Jornalismo 24 horas, economia, política e giro internacional',
    color: '#f97316',
    gradient: 'from-amber-600 to-orange-700',
    subcategories: ['Todos', 'Cobertura Ao Vivo 24h', 'Economia & Política']
  },
  {
    id: 'entretenimento',
    label: 'Entretenimento & Pop',
    iconName: 'Clapperboard',
    description: 'Humor, reality shows, música, gastronomia e variedades',
    color: '#a855f7',
    gradient: 'from-purple-600 to-pink-600',
    subcategories: ['Todos', 'Variedades & Pop', 'Humor & Stand-Up', 'Música & Shows', 'Culinária, Arte & Viagens', 'Mundo Animal & Pets']
  },
  {
    id: 'agro',
    label: 'Agro & Campo',
    iconName: 'Tractor',
    description: 'Cotações de commodities, leilões ao vivo e tecnologia rural',
    color: '#84cc16',
    gradient: 'from-lime-600 to-green-700',
    subcategories: ['Todos', 'Agronegócio & Campo', 'Pecuária & Leilões']
  },
  {
    id: 'religioso',
    label: 'Fé & Espiritualidade',
    iconName: 'HeartHandshake',
    description: 'Missas, cultos, mensagens de oração e canais inspiracionais',
    color: '#eab308',
    gradient: 'from-yellow-600 to-amber-700',
    subcategories: ['Todos', 'Canais Católicos', 'Canais Evangélicos', 'Fé & Mensagens de Esperança']
  },
  {
    id: 'regional',
    label: 'Regionais do Brasil',
    iconName: 'MapPin',
    description: 'Emissoras de todos os estados e comunidades brasileiras',
    color: '#64748b',
    gradient: 'from-slate-600 to-gray-800',
    subcategories: ['Todos', 'Emissoras Locais & Comunitárias']
  },
  {
    id: 'favoritos',
    label: 'Meus Favoritos',
    iconName: 'Star',
    description: 'Seus canais preferidos salvos para acesso instantâneo',
    color: '#eab308',
    gradient: 'from-amber-500 to-yellow-600',
    subcategories: ['Todos']
  }
];

import { DollarSign, TrendingUp, Users, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const stats = [
    { title: 'MRR', value: 'R$ 14.500', change: '+12%', icon: DollarSign, trend: 'up' },
    { title: 'ARR', value: 'R$ 174.000', change: '+12%', icon: TrendingUp, trend: 'up' },
    { title: 'Salões Ativos', value: '184', change: '+4', icon: Users, trend: 'up' },
    { title: 'Agendamentos/dia', value: '2.450', change: '+150', icon: Activity, trend: 'up' },
  ];

  return (
    <div className="space-y-8 font-sans">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 shadow-sm flex items-center justify-between backdrop-blur-sm relative overflow-hidden group">
            {/* Hover subtle glow */}
            <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors pointer-events-none" />
            
            <div className="relative z-10">
              <p className="text-sm font-medium text-zinc-400 mb-2">{stat.title}</p>
              <h3 className="text-3xl font-bold text-zinc-100 tracking-tight">{stat.value}</h3>
              <p className={`text-xs mt-3 font-semibold px-2 py-1 inline-block rounded-full ${stat.trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {stat.change} este mês
              </p>
            </div>
            <div className="relative z-10 w-14 h-14 bg-zinc-800/80 border border-zinc-700/50 rounded-2xl flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 shadow-sm min-h-[340px] flex flex-col justify-center items-center backdrop-blur-sm relative overflow-hidden">
            <TrendingUp className="w-12 h-12 text-zinc-800 mb-4" />
            <p className="text-zinc-500 font-medium text-sm">Gráfico de Crescimento MRR em desenvolvimento</p>
         </div>
         <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 shadow-sm min-h-[340px] flex flex-col justify-center items-center backdrop-blur-sm relative overflow-hidden">
            <Users className="w-12 h-12 text-zinc-800 mb-4" />
            <p className="text-zinc-500 font-medium text-sm">Painel de Retenção de Clientes em desenvolvimento</p>
         </div>
      </div>
    </div>
  );
}

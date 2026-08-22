import { useState, useRef } from 'react';
import { Upload, Loader2, Check } from 'lucide-react';
import { useServices, type Service, type ServiceInput } from '../../../hooks/useServices';
import { useCategories } from '../../../hooks/useCategories';
import type { Professional } from '../../../types/database';
import { useTheme } from '../../../contexts/ThemeContext';
import { Modal } from '../../../components/ui/Modal';

const COLOR_PALETTE = ['#C9963B', '#E8B960', '#60a5fa', '#a78bfa', '#34d399', '#f87171', '#fb923c', '#f472b6', '#4ade80', '#94a3b8'];

interface Props {
  service?: Service | null;
  professionals?: Professional[];
  tenantId: string;
  onClose: () => void;
  onSave: (input: ServiceInput) => Promise<void>;
  isLoading?: boolean;
}

export default function ServiceModal({ service, professionals = [], tenantId, onClose, onSave, isLoading }: Props) {
  const { theme } = useTheme();
  const { categories } = useCategories(tenantId);
  const isEdit = !!service;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(service?.name ?? '');
  const serviceCategories = categories.filter(c => c.type === 'service' || c.type === 'both');
  const [category, setCategory] = useState(() => {
    if (service?.category) return service.category;
    if (serviceCategories.length > 0) return serviceCategories[0].name;
    return 'Outros';
  });
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(String(service?.price ?? ''));
  const [originalPrice, setOriginalPrice] = useState(String(service?.original_price ?? ''));
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [buffer, setBuffer] = useState(String(service?.buffer_minutes ?? 0));
  const [color, setColor] = useState(service?.color ?? '#C9963B');
  const [commission, setCommission] = useState(String(service?.commission_pct ?? 0));
  const [code, setCode] = useState(service?.code ?? '');
  const [tags, setTags] = useState(service?.tags?.join(', ') ?? '');
  const [notes, setNotes] = useState(service?.notes ?? '');
  const [active, setActive] = useState(service?.active ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(service?.display_order ?? 0));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(service?.photo_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hybrid Location fields (migration 0046)
  const [serviceMode, setServiceMode] = useState<'instore' | 'home' | 'both'>(service?.service_mode ?? 'instore');
  const [homePriceExtra, setHomePriceExtra] = useState(String(service?.home_price_extra ?? 0));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome é obrigatório.';
    if (!price || isNaN(Number(price))) errs.price = 'Preço inválido.';
    if (!duration || isNaN(Number(duration))) errs.duration = 'Duração inválida.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await onSave({
      name: name.trim(),
      category,
      description: description.trim() || null,
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      duration_minutes: Number(duration),
      buffer_minutes: Number(buffer) || 0,
      color,
      commission_pct: Number(commission) || 0,
      code: code.trim() || null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: notes.trim() || null,
      active,
      display_order: Number(displayOrder) || 0,
      photo_url: service?.photo_url ?? null,
      photoFile: photoFile ?? undefined,
      service_mode: serviceMode,
      home_price_extra: Number(homePriceExtra) || 0,
    });
  };

  const totalTime = (Number(duration) || 0) + (Number(buffer) || 0);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEdit ? 'Editar Serviço' : 'Novo Serviço'}
      subtitle="Preencha os detalhes do serviço"
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden flex items-center justify-center transition-colors" style={{ borderColor: theme.border, background: theme.inputBg }}>
            {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6" style={{ color: theme.textSecondary }} />}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg, image/png, image/webp" className="hidden" onChange={handlePhotoChange} />
          <div className="flex-1">
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Nome do Serviço *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: errors.name ? theme.error : theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: Corte Masculino" />
            {errors.name && <p className="text-xs mt-1" style={{ color: theme.error }}>{errors.name}</p>}
          </div>
        </div>

        {/* Category + Code */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}>
              {serviceCategories.length === 0 && <option value="Outros">Outros</option>}
              {serviceCategories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
              {service?.category && !serviceCategories.find(c => c.name === service.category) && (
                <option value={service.category}>{service.category} (Antiga)</option>
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Código Interno</label>
            <input value={code} onChange={e => setCode(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: SVC-001" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Descrição</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Descreva o serviço..." />
        </div>

        {/* Price row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Preço (R$) *</label>
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: errors.price ? theme.error : theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="0.00" />
            {errors.price && <p className="text-xs mt-1" style={{ color: theme.error }}>{errors.price}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Preço Antigo (Riscado)</label>
            <input type="number" min="0" step="0.01" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: De R$ 80" />
          </div>
        </div>

        {/* Location / Mode */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Onde é realizado?</label>
            <select value={serviceMode} onChange={e => setServiceMode(e.target.value as 'instore' | 'home' | 'both')} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}>
              <option value="instore">🏠 Apenas no estabelecimento</option>
              <option value="home">🚗 Apenas a domicílio</option>
              <option value="both">✨ Nos dois (cliente escolhe)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Acréscimo domicílio (R$)</label>
            <input 
              type="number" 
              min="0" step="0.50" 
              value={homePriceExtra} 
              onChange={e => setHomePriceExtra(e.target.value)} 
              disabled={serviceMode === 'instore'}
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input disabled:opacity-50" 
              style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} 
              placeholder="Ex: 15.00" 
            />
          </div>
        </div>

        {/* Duration + Buffer */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Duração (min) *</label>
            <input type="number" min="5" step="5" value={duration} onChange={e => setDuration(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: errors.duration ? theme.error : theme.border, background: theme.inputBg, color: theme.textPrimary }} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Buffer (min)</label>
            <input type="number" min="0" step="5" value={buffer} onChange={e => setBuffer(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} />
          </div>
          <div className="flex flex-col justify-end pb-1">
            <div className="rounded-xl border px-3 py-3 text-center" style={{ background: `${theme.accent}10`, borderColor: `${theme.accent}30` }}>
              <p className="text-[10px] mb-0.5" style={{ color: theme.textSecondary }}>Total bloqueado</p>
              <p className="text-sm font-bold" style={{ color: theme.accent }}>{totalTime} min</p>
            </div>
          </div>
        </div>

        {/* Commission + Order */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Comissão (%)</label>
            <input type="number" min="0" max="100" value={commission} onChange={e => setCommission(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Ordem Exibição</label>
            <input type="number" min="0" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} />
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Cor do Serviço</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`} style={{ background: c }} />
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Tags (separadas por vírgula)</label>
          <input value={tags} onChange={e => setTags(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: masculino, rápido, premium" />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Observações Internas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Notas para uso interno..." />
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: theme.border, background: theme.inputBg }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Serviço ativo</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Aparece na agenda e na página pública</p>
          </div>
          <button type="button" onClick={() => setActive(prev => !prev)} className="w-12 h-6 rounded-full relative transition-all" style={{ background: active ? theme.accent : theme.border }}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${active ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t mt-4" style={{ borderColor: theme.border }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border font-semibold text-sm transition-all hover:bg-[var(--theme-bg-hover)]" style={{ borderColor: theme.border, color: theme.textPrimary }}>Cancelar</button>
          <button onClick={handleSave} disabled={isLoading} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.4)] disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}>
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4" /> {isEdit ? 'Salvar' : 'Criar Serviço'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}


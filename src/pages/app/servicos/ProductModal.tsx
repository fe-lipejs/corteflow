import { useState, useRef } from 'react';
import { Upload, Loader2, Check } from 'lucide-react';
import { processFileIfHeic } from '../../../lib/imageHelper';
import type { Product, ProductInput } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { useTheme } from '../../../contexts/ThemeContext';
import { Modal } from '../../../components/ui/Modal';

interface Props {
  product?: Product | null;
  tenantId: string;
  onClose: () => void;
  onSave: (input: ProductInput) => Promise<void>;
  isLoading?: boolean;
}

export default function ProductModal({ product, tenantId, onClose, onSave, isLoading }: Props) {
  const { theme } = useTheme();
  const { categories } = useCategories(tenantId);
  const isEdit = !!product;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? '');
  
  const productCategories = categories.filter(c => c.type === 'product' || c.type === 'both');
  const [category, setCategory] = useState(() => {
    if (product?.category) return product.category;
    if (productCategories.length > 0) return productCategories[0].name;
    return 'Outros';
  });
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [promoPrice, setPromoPrice] = useState(String(product?.promo_price ?? ''));
  const [code, setCode] = useState(product?.code ?? '');
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? 0));
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [active, setActive] = useState(product?.active ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(product?.display_order ?? 0));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(product?.photo_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (file) {
      file = await processFileIfHeic(file);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome é obrigatório.';
    if (!price || isNaN(Number(price))) errs.price = 'Preço inválido.';
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
      promo_price: promoPrice ? Number(promoPrice) : null,
      code: code.trim() || null,
      stock: Number(stock) || 0,
      min_stock: Number(minStock) || 0,
      brand: brand.trim() || null,
      photo_url: product?.photo_url ?? null,
      active,
      display_order: Number(displayOrder) || 0,
      photoFile: photoFile ?? undefined,
    });
  };

  const lowStock = Number(stock) <= Number(minStock) && Number(minStock) > 0;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEdit ? 'Editar Produto' : 'Novo Produto'}
      subtitle="Dados do produto"
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden flex items-center justify-center transition-colors" style={{ borderColor: theme.border, background: theme.inputBg }}>
            {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> : <Upload className="w-6 h-6" style={{ color: theme.textSecondary }} />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          <div className="flex-1">
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Nome do Produto *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: errors.name ? theme.error : theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: Pomada Modeladora" />
            {errors.name && <p className="text-xs mt-1" style={{ color: theme.error }}>{errors.name}</p>}
          </div>
        </div>

        {/* Category & Brand */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }}>
              {productCategories.length === 0 && <option value="Outros">Outros</option>}
              {productCategories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
              {product?.category && !productCategories.find(c => c.name === product.category) && (
                <option value={product.category}>{product.category} (Antiga)</option>
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Marca</label>
            <input value={brand} onChange={e => setBrand(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: L'Oréal" />
          </div>
        </div>

        {/* Code & Description */}
        <div>
          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Código / Cód. Barras</label>
          <input value={code} onChange={e => setCode(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: PRD-001" />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Descrição</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Descreva o produto..." />
        </div>

        {/* Price row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Preço (R$) *</label>
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: errors.price ? theme.error : theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="0.00" />
            {errors.price && <p className="text-xs mt-1" style={{ color: theme.error }}>{errors.price}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Preço Promocional</label>
            <input type="number" min="0" step="0.01" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} placeholder="Ex: 80.00" />
          </div>
        </div>

        {/* Stock */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Estoque Atual</label>
            <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: lowStock ? theme.warning : theme.border, background: theme.inputBg, color: theme.textPrimary }} />
            {lowStock && <p className="text-[10px] mt-1 font-bold" style={{ color: theme.warning }}>Estoque baixo (Mín: {minStock})</p>}
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Estoque Mínimo</label>
            <input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: theme.textSecondary }}>Ordem Exibição</label>
            <input type="number" min="0" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none themed-input" style={{ borderColor: theme.border, background: theme.inputBg, color: theme.textPrimary }} />
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: theme.border, background: theme.inputBg }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Produto ativo</p>
            <p className="text-xs" style={{ color: theme.textSecondary }}>Disponível para venda</p>
          </div>
          <button type="button" onClick={() => setActive(prev => !prev)} className="w-12 h-6 rounded-full relative transition-all" style={{ background: active ? theme.accent : theme.border }}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${active ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t mt-4" style={{ borderColor: theme.border }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border font-semibold text-sm transition-all hover:bg-[var(--theme-bg-hover)]" style={{ borderColor: theme.border, color: theme.textPrimary }}>Cancelar</button>
          <button onClick={handleSave} disabled={isLoading} className="flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-[0_0_20px_rgba(201,150,59,0.2)] hover:shadow-[0_0_30px_rgba(201,150,59,0.4)] disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: theme.accentGradient, color: theme.btnPrimaryText, boxShadow: theme.shadowAccent }}>
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4" /> {isEdit ? 'Salvar' : 'Criar Produto'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}


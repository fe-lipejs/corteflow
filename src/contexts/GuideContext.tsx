import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';

export interface TourStep {
  target: string; // CSS selector or data-guide attribute
  title: string;
  description: string;
  badge?: string;
  route?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-guide="nav-configuracoes"]',
    title: 'Configurações do Estabelecimento ⚙️',
    description: 'Aqui você personaliza a identidade visual, define horários de funcionamento e conecta o Stripe para receber pagamentos online (Pix e cartão).',
    badge: 'Passo 1 de 4',
    route: '/admin',
  },
  {
    target: '[data-guide="nav-agenda"]',
    title: 'Sua Agenda Inteligente 📅',
    description: 'Acompanhe agendamentos diários e semanais da sua equipe em tempo real, crie novos horários e veja a ocupação do salão.',
    badge: 'Passo 2 de 4',
    route: '/admin',
  },
  {
    target: '[data-guide="nav-servicos"]',
    title: 'Serviços & Produtos ✂️',
    description: 'Cadastre os serviços que seus clientes poderão agendar pelo seu site com preços, duração e fotos.',
    badge: 'Passo 3 de 4',
    route: '/admin',
  },
  {
    target: '[data-guide="nav-equipe"]',
    title: 'Gestão da sua Equipe 💈',
    description: 'Cadastre seus profissionais e barbeiros com horários individuais de trabalho e serviços que cada um realiza.',
    badge: 'Passo 4 de 4',
    route: '/admin',
  },
];

interface GuideContextType {
  completedGuides: string[];
  isTourActive: boolean;
  tourStep: number;
  showTourInvite: boolean;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  stopTour: () => void;
  dismissTourInvite: () => void;
  isGuideCompleted: (guideId: string) => boolean;
  completeGuide: (guideId: string) => Promise<void>;
  dismissAllGuides: () => Promise<void>;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'navalha_completed_guides';

export const GuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [completedGuides, setCompletedGuides] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showTourInvite, setShowTourInvite] = useState(false);

  // Check if tour invite should be shown on initial load
  useEffect(() => {
    const hasSeenTour = completedGuides.includes('tour_completed') || completedGuides.includes('tour_dismissed');
    if (!hasSeenTour) {
      // Delay slightly for initial render
      const timer = setTimeout(() => {
        setShowTourInvite(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [completedGuides]);

  // Sync with profile when user loads
  useEffect(() => {
    if (profile && (profile as any).completed_guides) {
      const dbGuides: string[] = Array.isArray((profile as any).completed_guides)
        ? (profile as any).completed_guides
        : [];
      
      setCompletedGuides((prev) => {
        const merged = Array.from(new Set([...prev, ...dbGuides]));
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }
        return merged;
      });
    }
  }, [profile]);

  const completeGuide = useCallback(
    async (guideId: string) => {
      const updated = Array.from(new Set([...completedGuides, guideId]));
      setCompletedGuides(updated);

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      if (user?.id) {
        try {
          await supabase
            .from('profiles')
            .update({ completed_guides: updated } as any)
            .eq('id', user.id);
        } catch (err) {
          console.warn('Failed to sync completed guide to DB:', err);
        }
      }
    },
    [completedGuides, user?.id]
  );

  const startTour = useCallback(() => {
    setShowTourInvite(false);
    setTourStep(0);
    setIsTourActive(true);
  }, []);

  const stopTour = useCallback(() => {
    setIsTourActive(false);
    completeGuide('tour_completed');
  }, [completeGuide]);

  const dismissTourInvite = useCallback(() => {
    setShowTourInvite(false);
    completeGuide('tour_dismissed');
  }, [completeGuide]);

  const nextTourStep = useCallback(() => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep((prev) => prev + 1);
    } else {
      stopTour();
    }
  }, [tourStep, stopTour]);

  const prevTourStep = useCallback(() => {
    if (tourStep > 0) {
      setTourStep((prev) => prev - 1);
    }
  }, [tourStep]);

  const isGuideCompleted = useCallback(
    (guideId: string) => completedGuides.includes(guideId),
    [completedGuides]
  );

  const dismissAllGuides = useCallback(async () => {
    setIsTourActive(false);
    setShowTourInvite(false);
    const allKnown = ['tour_completed', 'tour_dismissed', 'all_dismissed'];
    const updated = Array.from(new Set([...completedGuides, ...allKnown]));
    setCompletedGuides(updated);

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    if (user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ completed_guides: updated } as any)
          .eq('id', user.id);
      } catch (err) {
        console.warn('Failed to sync dismissAll to DB:', err);
      }
    }
  }, [completedGuides, user?.id]);

  return (
    <GuideContext.Provider
      value={{
        completedGuides,
        isTourActive,
        tourStep,
        showTourInvite,
        startTour,
        nextTourStep,
        prevTourStep,
        stopTour,
        dismissTourInvite,
        isGuideCompleted,
        completeGuide,
        dismissAllGuides,
      }}
    >
      {children}
    </GuideContext.Provider>
  );
};

export const useGuide = () => {
  const context = useContext(GuideContext);
  if (!context) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return context;
};


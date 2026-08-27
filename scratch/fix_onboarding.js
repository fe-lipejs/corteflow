
const fs = require('fs');
let code = fs.readFileSync('../src/pages/Onboarding.tsx', 'utf8');

code = code.replace(
  '      if (profile?.onboarding_completed || profile?.tenant_id || tenant?.id) {\\n        navigate(\'/admin\', { replace: true });\\n        return;\\n      }',
  \      if (profile?.onboarding_completed) {
        navigate('/admin', { replace: true });
        return;
      }
      if (profile?.tenant_id || tenant?.id) {
        setStep(4);
      }\
);

code = code.replace(
  '        if (existingTenant?.id) {\\n          navigate(\'/admin\', { replace: true });\\n        }',
  \        if (existingTenant?.id) {
          if (!profile?.onboarding_completed) {
            setStep(4);
          } else {
            navigate('/admin', { replace: true });
          }
        }\
);

code = code.replace(
  'phone_normalized: normalizedPhone || user.user_metadata?.phone_normalized || \\'\\',\\n          onboarding_completed: true,\\n        } as any);\\n        await refreshProfile();\\n        window.location.href = \\'/admin\\';\\n        return;',
  \phone_normalized: normalizedPhone || user.user_metadata?.phone_normalized || '',
        } as any);
        await refreshProfile();
        setStep(4);
        setLoading(false);
        return;\
);

code = code.replace(
  'phone_normalized: normalizedPhone || user.user_metadata?.phone_normalized || \\'\\',\\n        onboarding_completed: true,\\n      } as any);',
  \phone_normalized: normalizedPhone || user.user_metadata?.phone_normalized || '',
      } as any);\
);

code = code.replace(
  'onClick={async () => {\\n                        setLoading(true);\\n                        try {\\n                          const { data: plan } = await supabase.from(\\'plans\\').select(\\'id\\').eq(\\'key\\', \\'studio_tier\\').single();',
  \onClick={async () => {
                        setLoading(true);
                        try {
                          await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user?.id);
                          await refreshProfile();
                          const { data: plan } = await supabase.from('plans').select('id').eq('key', 'growth').single();\
);

code = code.replace(
  'onClick={() => {\\n                        window.location.href = \\'/admin\\'; // Dashboard/Visão Geral\\n                      }}',
  \onClick={async () => {
                        await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user?.id);
                        await refreshProfile();
                        window.location.href = '/admin'; // Dashboard/Visão Geral
                      }}\
);

code = code.replace(/>Plano Studio</g, '>Plano Growth<');

fs.writeFileSync('../src/pages/Onboarding.tsx', code);

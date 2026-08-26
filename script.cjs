const fs = require('fs');
const path = 'src/pages/public/PublicStore.tsx';
let content = fs.readFileSync(path, 'utf-8');

const startIndex = content.indexOf('const cleanPhone = customerPhone.replace(/\\D/g, "");');
const endIndex = content.indexOf('if (bErr) throw bErr;') + 'if (bErr) throw bErr;'.length;

if (startIndex !== -1 && endIndex !== -1) {
    const newLogic = `        let proId = selectedPro === "any" ? null : selectedPro?.id;
        if (selectedPro === "any") {
          const slot = availableSlots.find((s) => s.time === selectedTime);
          if (slot?.availableProIds?.length) {
            proId = slot.availableProIds[Math.floor(Math.random() * slot.availableProIds.length)];
          } else {
            proId = professionalsList[0]?.id || null;
          }
        }

        if (bookingMode === 'home' && (!proId || selectedPro === 'any')) {
          setErrorMsg("Para atendimento a domicílio, escolha um profissional específico.");
          setIsProcessing(false);
          return;
        }

        const pad = (n) => String(n).padStart(2, "0");
        const tzOffsetMin = -new Date().getTimezoneOffset();
        const tzSign = tzOffsetMin >= 0 ? "+" : "-";
        const tzAbs = Math.abs(tzOffsetMin);
        const tzStr = \`\${tzSign}\${pad(Math.floor(tzAbs / 60))}:\${pad(tzAbs % 60)}\`;
        const scheduledAt = \`\${format(selectedDate, "yyyy-MM-dd")}T\${selectedTime}:00\${tzStr}\`;

        const payload = {
          tenant_id: tenant.id,
          service_id: selectedService.id,
          professional_id: proId,
          customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
          },
          scheduled_at: scheduledAt,
          booking_mode: bookingMode,
          payment_scope: paymentScope,
          payment_method: paymentMethod,
          client_address: bookingMode === 'home' ? (homeLocationData?.address ?? "") : null,
          client_lat: bookingMode === 'home' && homeLocationData ? homeLocationData?.lat : null,
          client_lng: bookingMode === 'home' && homeLocationData ? homeLocationData?.lng : null,
          customer_notes: customerNotes
        };

        const { data: functionResponse, error: functionError } = await supabase.functions.invoke("create-public-booking", {
          body: payload
        });

        if (functionError) {
          throw new Error(functionError.message || "Erro ao agendar.");
        }

        if (functionResponse?.error) {
           throw new Error(functionResponse.error);
        }

        const newBooking = functionResponse?.booking;
        if (!newBooking) throw new Error("Erro desconhecido ao criar agendamento.");`;

    const newContent = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
    fs.writeFileSync(path, newContent);
    console.log('Replaced via JS script!');
} else {
    console.log('Could not find indices', startIndex, endIndex);
}

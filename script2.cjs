const fs = require('fs');
const path = 'src/pages/public/PublicStore.tsx';
let content = fs.readFileSync(path, 'utf-8');

// 1. Update maxRadiusKm in HomeLocationWizard
content = content.replace('maxRadiusKm={settings?.home_service_radius_km || 10}', 'maxRadiusKm={professionalsList.length ? Math.max(...professionalsList.map((p: any) => p.max_home_distance_km || 0)) : 0}');

// 2. Update feeConfig
const old_fee = `feeConfig={{
                                  enabled: true,
                                  feeType: settings?.home_fee_type || 'fixed',
                                  feeAmount: settings?.home_fee_amount || 0,
                                  feePerKm: settings?.home_fee_per_km || 0,
                                  radiusKm: settings?.home_service_radius_km || 10
                                }}`;
const new_fee = `feeConfig={{
                                  enabled: false,
                                  feeType: 'free',
                                  feeAmount: 0,
                                  feePerKm: 0,
                                  radiusKm: 0
                                }}`;
content = content.replace(old_fee, new_fee);

// 3. Update filter
const old_filter = `    if (bookingMode === 'home') {
      const salonRadius = settings?.home_service_radius_km || 10;
      list = list.filter((p: any) => {
        if (!p.offers_home_service) return false;
        if ((homeLocationData?.distanceKm ?? null) == null) return true;
        const effectiveRadius = p.max_home_distance_km && p.max_home_distance_km > 0
          ? Math.min(p.max_home_distance_km, salonRadius)
          : salonRadius;
        return homeLocationData!.distanceKm! <= effectiveRadius;
      });
    }`;

const new_filter = `    if (bookingMode === 'home') {
      list = list.filter((p: any) => {
        if (!p.offers_home_service) return false;
        if ((homeLocationData?.distanceKm ?? null) == null) return true;
        const effectiveRadius = p.max_home_distance_km || 0;
        return homeLocationData!.distanceKm! <= effectiveRadius;
      });
    }`;
content = content.replace(old_filter, new_filter);

const old_travel_fee = 'const travelFee = homeLocationData?.travelFee ?? 0;';
const new_travel_fee = 'const travelFee = (bookingMode === \'home\' && selectedPro && selectedPro !== \'any\') ? (selectedPro.home_fee || 0) : 0;';
content = content.replace(old_travel_fee, new_travel_fee);

// 4. Edge function logic
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

        const pad = (n: number) => String(n).padStart(2, "0");
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

    content = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
    
    // Also replace setBookingCode(code) with setBookingCode(newBooking.order_number)
    content = content.replace('setBookingCode(code);', 'setBookingCode(newBooking.order_number);');
    
    fs.writeFileSync(path, content, 'utf8');
    console.log('Replaced via JS script!');
} else {
    console.log('Could not find indices', startIndex, endIndex);
}


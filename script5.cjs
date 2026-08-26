const fs = require('fs');
let content = fs.readFileSync('supabase/functions/create-public-booking/index.ts', 'utf-8');

const selectOld = `.select('id, offers_home_service, max_home_distance_km, home_fee, active')`;
const selectNew = `.select('id, offers_home_service, max_home_distance_km, home_fee, home_fee_type, home_fee_per_km, active')`;
content = content.replace(selectOld, selectNew);

const travelFeeOld = `travel_fee = professional.home_fee || 0;`;
const travelFeeNew = `if (professional.home_fee_type === 'per_km') {
          travel_fee = (professional.home_fee_per_km || 0) * distanceKm;
        } else {
          travel_fee = professional.home_fee || 0;
        }`;
content = content.replace(travelFeeOld, travelFeeNew);

fs.writeFileSync('supabase/functions/create-public-booking/index.ts', content, 'utf-8');
console.log('Edge Function updated successfully!');

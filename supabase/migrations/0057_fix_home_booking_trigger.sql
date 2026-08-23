-- ============================================================
-- Migration 0057: Fix Home Booking Trigger
-- Updates the check_home_booking trigger to also fire on UPDATE
-- to prevent bypassing location checks after initial creation.
-- ============================================================

DROP TRIGGER IF EXISTS trigger_check_home_booking ON bookings;
CREATE TRIGGER trigger_check_home_booking
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_home_booking_rules();

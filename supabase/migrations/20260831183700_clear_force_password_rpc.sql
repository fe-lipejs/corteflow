-- Migration to add RPC to clear force_password_change

CREATE OR REPLACE FUNCTION clear_force_password_change(p_professional_id UUID)
RETURNS void AS $$
BEGIN
    -- Ensure the user is updating their own record (or is a super admin)
    -- We bypass RLS using SECURITY DEFINER so they can update themselves
    -- We double check that the auth_user_id matches the logged in user
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE professionals
    SET force_password_change = false
    WHERE id = p_professional_id
      AND auth_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * useBarberSound — Plays an MP3 file when a new booking arrives.
 * The MP3 file should be placed in the public folder at: /sounds/new-booking.mp3
 */
export function useBarberSound() {
  const play = (type: "booking" | "cancel" = "booking") => {
    // Only play sound for new bookings as requested by the user
    if (type !== "booking") return;

    try {
      const audio = new Audio('/sounds/new-booking.mp3');
      audio.play().catch((e) => {
        // Silently ignore autoplay restrictions if user hasn't interacted with page yet
        console.warn("N\u00E3o foi poss\u00EDvel tocar o som de agendamento (interaja com a p\u00E1gina primeiro):", e);
      });
    } catch {
      // Silently ignore
    }
  };

  return { play };
}

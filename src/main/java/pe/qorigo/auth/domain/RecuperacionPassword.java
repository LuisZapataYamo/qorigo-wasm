package pe.qorigo.auth.domain;

import java.time.Instant;

public record RecuperacionPassword(
        Long idRecuperacion,
        Long idUsuario,
        String tokenHash,
        Instant expiraEn,
        boolean usado,
        Instant creadoEn
) {
    public boolean vigente(Instant ahora) {
        return !usado && expiraEn.isAfter(ahora);
    }
}
